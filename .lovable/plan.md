

## Problem

Build error in `generate-patient-summary/index.ts` at line 211: the `serviceClient` (created with `@supabase/supabase-js@2`) is incompatible with `logTokenUsage`'s parameter type (`SupabaseClient` from `@supabase/supabase-js@2.39.3`). Different sub-versions produce incompatible TypeScript types.

## Root Cause

`supabase/functions/_shared/tokenTracking.ts` imports `SupabaseClient` from `https://esm.sh/@supabase/supabase-js@2.39.3` (pinned), while `generate-patient-summary/index.ts` imports `createClient` from `https://esm.sh/@supabase/supabase-js@2` (floating). The resulting `SupabaseClient` types are structurally incompatible.

## Fix

Change the import in `tokenTracking.ts` from the pinned version `@2.39.3` to the floating `@2` to match all edge functions:

```typescript
// Before
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// After
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
```

This single-line change resolves the type mismatch across all edge functions that import `logTokenUsage`.

## Validation

After the fix:
1. Redeploy all 4 edge functions that use `tokenTracking`: `chat`, `upload-pdf`, `analyze-food-image`, `generate-patient-summary`
2. The weight tracking migration (`20260303000000_weight_tracking.sql`) is already applied — `weight_entries` table and `profiles` columns (`height`, `target_weight`, `weight_unit`) exist in the types

## Status Summary

- All 23 migrations: applied
- Weight tracking feature: schema ready, types present, components exist
- Token tracking: needs the one-line import fix, then redeploy

