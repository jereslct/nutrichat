# Architectural Patterns

This document describes recurring patterns and conventions used throughout the NutriChat codebase.

## Authentication & Authorization

### Pattern: JWT-based Auth with Supabase
**Where:** All protected pages, edge functions
**Example:** src/pages/Chat.tsx:68-99, supabase/functions/chat/index.ts:19-57

```typescript
// Frontend: Check session on mount and listen for changes
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (!session) navigate("/register");
    }
  );

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) navigate("/register");
  });

  return () => subscription.unsubscribe();
}, []);

// Edge Functions: Verify JWT and get user
const authHeader = req.headers.get("Authorization");
const token = authHeader.replace("Bearer ", "");
const { data: { user }, error } = await supabaseClient.auth.getUser(token);
```

**Key Points:**
- Always set up auth listener BEFORE checking session (prevents race conditions)
- Edge functions: validate JWT with `auth.getUser(token)`, never trust user_id from body
- Use `session.access_token` when calling edge functions from frontend

### Pattern: Role-based Access Control
**Where:** src/hooks/useUserRole.ts, pages with role checks
**Example:** src/hooks/useUserRole.ts:19-102

Centralized hook that fetches user + role + profile data:
```typescript
const { user, role, loading, profile } = useUserRole();
// role: "patient" | "doctor" | null
```

**Implementation:**
- Roles stored in `user_roles` table (not auth.users metadata)
- Hook subscribes to auth changes and refetches role
- Uses `setTimeout(..., 0)` in auth listener to avoid Supabase client deadlocks (line 70)
- Always check `loading` before rendering role-dependent UI

## Database Access

### Pattern: Row Level Security (RLS)
**Where:** All Supabase tables
**Example:** supabase/migrations/20251126012608_*.sql:11-23

**Standard RLS policies for user-owned data:**
```sql
-- Enable RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Users see only their own data
CREATE POLICY "Users can view own data"
  ON public.table_name FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON public.table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Similar for UPDATE, DELETE
```

**Cross-user access (doctors viewing patients):**
- Implement via edge functions with service role key
- Never expose service role to frontend
- Validate permissions in edge function logic

### Pattern: Type-safe Database Client
**Where:** src/integrations/supabase/
**Files:** client.ts, types.ts, safeClient.ts

```typescript
// Auto-generated types from database schema
import type { Database } from './types';

// Typed client
export const supabase = createClient<Database>(URL, KEY);

// Usage with full type safety
const { data } = await supabase
  .from("profiles")  // ✓ Autocomplete knows all tables
  .select("full_name, avatar_url")  // ✓ Autocomplete knows columns
  .eq("id", userId)
  .single();
```

**Pattern details:**
- types.ts is auto-generated: `supabase gen types typescript`
- Never manually edit types.ts
- Vite alias redirects client.ts imports to safeClient.ts (vite.config.ts:15-18)

### Pattern: Automated Timestamp Updates
**Where:** Database triggers on tables with updated_at
**Example:** supabase/migrations (multiple files)

```sql
-- Reusable trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

## Edge Functions

### Pattern: Dual-client Authentication
**Where:** All edge functions requiring auth
**Example:** supabase/functions/chat/index.ts:34-66

```typescript
// 1. User-scoped client (respects RLS)
const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { global: { headers: { Authorization: authHeader } } }
);

// 2. Admin client (bypasses RLS)
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Use supabaseClient for user-owned operations
const { data: diet } = await supabaseClient
  .from("diets")
  .select("*")
  .single();  // ✓ RLS ensures user owns this

// Use supabaseAdmin for cross-user operations or metrics
await supabaseAdmin
  .from("user_usage")
  .update({ daily_query_count: count + 1 })
  .eq("user_id", userId);
```

**When to use each:**
- `supabaseClient`: User-owned data (RLS enforces access)
- `supabaseAdmin`: Cross-user queries, usage tracking, admin operations

### Pattern: CORS Headers
**Where:** All edge functions
**Example:** supabase/functions/chat/index.ts:5-8, 14-16

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Handle preflight
if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}

// Include in all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

### Pattern: Usage Quota Enforcement
**Where:** Edge functions with rate limits
**Example:** supabase/functions/chat/index.ts:68-82 (premium check)

```typescript
// Fetch user's subscription status
const { data: profile } = await supabaseAdmin
  .from("profiles")
  .select("subscription_status, chat_count, is_premium")
  .eq("id", userId)
  .single();

// Check for active subscription OR legacy premium flag
const isActiveSubscriber =
  profile.subscription_status === "active" ||
  profile.is_premium === true;

if (!isActiveSubscriber && profile.chat_count >= FREE_CHAT_LIMIT) {
  return new Response(
    JSON.stringify({
      error: "free_limit_reached",
      message: "Has alcanzado el límite de chats gratuitos"
    }),
    { status: 403, headers: corsHeaders }
  );
}
```

## Frontend Patterns

### Pattern: React Query for Server State
**Where:** App.tsx:4, any data fetching
**Example:** src/App.tsx:16-19

```typescript
const queryClient = new QueryClient();

<QueryClientProvider client={queryClient}>
  {/* app content */}
</QueryClientProvider>
```

Use for caching Supabase queries (wrap in useQuery when implementing new features).

### Pattern: Custom UI Components
**Where:** src/components/
**Example:** src/components/PremiumModal.tsx, DoctorSelector.tsx

**Composition pattern:**
```typescript
// Import shadcn primitives
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Compose feature component
export const PremiumModal = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Custom content */}
      </DialogContent>
    </Dialog>
  );
};
```

**Guidelines:**
- Keep feature components in `src/components/`
- Keep primitive UI in `src/components/ui/` (managed by shadcn)
- Use compound component pattern from Radix UI (Dialog, AlertDialog, etc.)

### Pattern: Toast Notifications
**Where:** All user-facing operations
**Example:** src/components/PremiumModal.tsx:23, 60

```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

// Success
toast({
  title: "¡Éxito!",
  description: "Operación completada",
});

// Error
toast({
  title: "Error",
  description: error.message,
  variant: "destructive",
});
```

Toaster components mounted in App.tsx:21-22.

### Pattern: Form Validation with Zod
**Where:** Forms throughout app
**Key files:** @hookform/resolvers, zod

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { email: "", password: "" },
});
```

shadcn form components wrap react-hook-form (see src/components/ui/form.tsx).

## Styling Patterns

### Pattern: Utility-first with Design Tokens
**Where:** All components
**Example:** tailwind.config.ts:16-93, src/index.css:10-85

**CSS Variables:**
```css
/* src/index.css */
:root {
  --primary: 142 76% 36%;  /* HSL values */
  --accent: 170 70% 45%;
}
```

**Tailwind Usage:**
```tsx
<div className="bg-primary text-primary-foreground">
  {/* Uses CSS variable */}
</div>
```

**Custom colors:** Extend in tailwind.config.ts:50-92 (neutral, success, info, etc.)

### Pattern: cn() Helper for Conditional Classes
**Where:** src/lib/utils.ts:4-6, used everywhere

```typescript
import { cn } from "@/lib/utils";

<Button className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "outline" && "outline-classes"
)} />
```

Combines clsx + tailwind-merge for proper Tailwind class precedence.

## Data Flow Patterns

### Pattern: Optimistic Updates with Realtime
**Where:** Chat interface, link requests
**Example:** src/pages/Chat.tsx:200+ (message handling)

```typescript
// 1. Update UI immediately (optimistic)
setMessages([...messages, { role: "user", content: input }]);

// 2. Call backend
const { data, error } = await supabase.functions.invoke("chat", {
  body: { message: input }
});

// 3. Handle response or rollback on error
if (error) {
  setMessages(messages); // Rollback
} else {
  setMessages([...messages, newMessage, data.response]);
}
```

### Pattern: Lazy Component Loading
**Where:** src/App.tsx:6-14
All pages imported as regular imports (not lazy). Consider lazy loading for route-level code splitting if bundle size grows.

## Migration Patterns

### Pattern: Idempotent Migrations
**Where:** supabase/migrations/*.sql

```sql
-- Safe: CREATE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.new_table (...);

-- Safe: Drop and recreate functions
CREATE OR REPLACE FUNCTION public.function_name() ...;

-- Safe: Add column if not exists (check first)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='profiles' AND column_name='new_column'
  ) THEN
    ALTER TABLE profiles ADD COLUMN new_column TEXT;
  END IF;
END $$;
```

**Naming:** Timestamp prefix from Supabase CLI: `YYYYMMDDHHMMSS_description.sql`

## Security Patterns

### Pattern: Input Validation
**Where:** Edge functions, form handlers

```typescript
// Edge functions: Validate all inputs
const { message, dietId } = await req.json();
if (!message || typeof message !== "string") {
  return new Response(
    JSON.stringify({ error: "Invalid input" }),
    { status: 400, headers: corsHeaders }
  );
}
```

### Pattern: Prevent SQL Injection
**Where:** All database queries

✅ **Safe (parameterized):**
```typescript
await supabase
  .from("diets")
  .select("*")
  .eq("user_id", userId);  // Supabase handles escaping
```

❌ **Unsafe (never do this):**
```typescript
await supabase.rpc("raw_query", {
  query: `SELECT * FROM diets WHERE user_id = '${userId}'`
});
```

## Testing Patterns

Currently no automated tests. When adding:
- Use Vitest (compatible with Vite)
- Mock Supabase client for unit tests
- Use Supabase local instance for integration tests

## Deployment

- **Frontend:** Built with `npm run build`, outputs to `dist/`
- **Edge Functions:** Auto-deployed with Supabase CLI or via Lovable platform
- **Migrations:** Applied with `supabase db push` or auto-sync in Lovable

---

**Note:** These patterns appear in multiple files across the codebase. When implementing new features, follow these established conventions for consistency.
