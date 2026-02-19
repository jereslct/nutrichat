# NutriChat AI - Project Guide

## What
NutriChat is a nutritional AI assistant web app that allows users to upload PDF diet plans and chat with an AI for personalized dietary guidance. Supports patient-doctor linking, premium subscriptions via MercadoPago, and multi-role access (patients, doctors, admins).

## Tech Stack

**Frontend:**
- React 18 + TypeScript + Vite
- UI: shadcn/ui (Radix UI primitives) + Tailwind CSS
- State: React Query (@tanstack/react-query)
- Routing: React Router v6
- Forms: react-hook-form + Zod validation

**Backend:**
- Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Edge Functions: Deno runtime
- AI: Lovable AI gateway (Gemini)
- Payments: MercadoPago API

**Build & Dev:**
- Vite with SWC for fast builds
- Path aliases: `@/` → `src/`
- Special alias: `@/integrations/supabase/client` → `safeClient.ts`

## Project Structure

```
src/
├── pages/              # Route components (Index, Chat, Upload, Profile, etc.)
├── components/
│   ├── ui/            # shadcn/ui components (never edit directly)
│   └── *.tsx          # Custom feature components
├── hooks/             # Custom hooks (useUserRole, useSuperAdmin)
├── lib/               # Utilities (utils.ts with cn() helper)
└── integrations/
    └── supabase/      # Supabase client, types, safeClient

supabase/
├── migrations/        # Database schema migrations (timestamped .sql files)
└── functions/         # Edge Functions (Deno TypeScript)
    ├── chat/
    ├── upload-pdf/
    ├── create-subscription/
    ├── mp-webhook/
    └── ...           # See supabase/functions/ for full list
```

**Key Directories:**
- `src/pages/`: One component per route (see src/App.tsx:24-32)
- `src/components/ui/`: Auto-generated shadcn components - modify via CLI only
- `src/components/`: Custom components (modals, selectors, etc.)
- `src/integrations/supabase/`: All Supabase-related code; types auto-generated
- `supabase/migrations/`: Database schema changes (create via Supabase CLI)
- `supabase/functions/`: Serverless edge functions for backend logic

## Essential Commands

```bash
# Development
npm run dev              # Start dev server on localhost:8080

# Build
npm run build            # Production build
npm run build:dev        # Development build
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint

# Supabase (requires Supabase CLI)
supabase start           # Start local Supabase
supabase functions serve # Serve edge functions locally
supabase db push         # Apply migrations
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## Environment Variables

Auto-managed by Lovable Cloud; local `.env.local` needs:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

Edge Functions require (set in Supabase dashboard):
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY (for AI)
MERCADOPAGO_ACCESS_TOKEN (for payments)
```

## Database Schema

**Core Tables:**
- `profiles`: User profiles (extends auth.users) - profiles.ts types
- `user_roles`: Role assignments (patient, doctor, admin)
- `diets`: Uploaded PDF diet plans with extracted text
- `chat_messages`: Chat history between users and AI
- `doctor_patients`: Links between doctors and patients
- `link_requests`: Pending link requests between users
- `subscriptions`: MercadoPago subscription tracking
- `user_usage`: Daily chat quota tracking

See src/integrations/supabase/types.ts:16-300+ for full schema definitions.

**Security:** All tables use Row Level Security (RLS). Policies in migrations/*.sql files.

## Routing

Routes defined in src/App.tsx:24-34:
- `/` - Landing page
- `/register` - Auth (login/signup)
- `/upload` - PDF upload
- `/chat` - AI chat interface
- `/profile` - User profile settings
- `/dashboard` - Doctor dashboard
- `/subscription` - Premium plans
- `/admin` - Admin panel
- `*` - 404 page

Protected routes should check auth in useEffect (see src/pages/Chat.tsx:68-99).

## Additional Documentation

When working on specific areas, consult:
- [Architectural Patterns](./.claude/docs/architectural_patterns.md) - Core patterns, auth flows, data fetching, edge function structure

## Development Notes

- **Never edit `src/components/ui/`** - these are managed by shadcn CLI
- **Database changes**: Create migrations, don't modify types.ts directly
- **Edge Functions**: Authenticate with JWT, use service role for admin ops
- **Styling**: Use Tailwind + CSS variables from src/index.css:10-85
- **Forms**: Prefer react-hook-form + Zod (see components/ui/form.tsx)
- **Theme**: Design system uses HSL color tokens (tailwind.config.ts:16-93)
