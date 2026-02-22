import { vi, type Mock } from "vitest";
import type { User, Session } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Fake data factories
// ---------------------------------------------------------------------------

export function createFakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    ...overrides,
  } as User;
}

export function createFakeSession(
  overrides: { user?: Partial<User>; access_token?: string } = {},
): Session {
  return {
    access_token: overrides.access_token ?? "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: createFakeUser(overrides.user),
  };
}

// ---------------------------------------------------------------------------
// Mock query builder  (chainable, thenable)
// ---------------------------------------------------------------------------

export interface MockQueryBuilder {
  select: Mock;
  insert: Mock;
  update: Mock;
  upsert: Mock;
  delete: Mock;
  eq: Mock;
  neq: Mock;
  gt: Mock;
  gte: Mock;
  lt: Mock;
  lte: Mock;
  in: Mock;
  is: Mock;
  order: Mock;
  limit: Mock;
  range: Mock;
  single: Mock;
  maybeSingle: Mock;
  then: (onfulfilled?: any, onrejected?: any) => Promise<any>;
}

export function createMockQueryBuilder(
  result: { data?: any; error?: any } = {},
): MockQueryBuilder {
  const resolved = { data: result.data ?? null, error: result.error ?? null };

  const builder: MockQueryBuilder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolved)),
    maybeSingle: vi.fn(() => Promise.resolve(resolved)),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(resolved).then(onfulfilled, onrejected),
  };

  return builder;
}

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

type AuthChangeCallback = (
  event: string,
  session: Session | null,
) => void;

export interface MockSupabaseClient {
  auth: {
    getSession: Mock;
    onAuthStateChange: Mock;
    signInWithPassword: Mock;
    signUp: Mock;
    signOut: Mock;
  };
  from: Mock;
  functions: {
    invoke: Mock;
  };
  /** Trigger the callback registered via `onAuthStateChange`. */
  _triggerAuthChange: (event: string, session: Session | null) => void;
  /** Pre-configure the result returned by `from(table)` query chains. */
  _setQueryResult: (
    table: string,
    result: { data?: any; error?: any },
  ) => void;
  /** Clear per-table results and internal state (call alongside `vi.clearAllMocks`). */
  _reset: () => void;
}

/**
 * Creates a fully-mocked Supabase client suitable for unit tests.
 *
 * The mock supports:
 * - `auth.getSession()` / `auth.onAuthStateChange()`
 * - `auth.signInWithPassword()` / `auth.signUp()` / `auth.signOut()`
 * - `.from(table).select().eq().single()` and similar query-builder chains
 * - `functions.invoke()`
 *
 * @example
 * ```ts
 * import { createMockSupabaseClient, createFakeSession } from "@/test/mocks/supabase";
 *
 * // Inside vi.mock (async factory so the import resolves correctly):
 * vi.mock("@/integrations/supabase/client", async () => {
 *   const { createMockSupabaseClient } = await import("@/test/mocks/supabase");
 *   return { supabase: createMockSupabaseClient() };
 * });
 *
 * // Then obtain the same instance through the mocked module:
 * import { supabase } from "@/integrations/supabase/client";
 * const mockSupabase = supabase as unknown as MockSupabaseClient;
 *
 * // Configure per test:
 * mockSupabase.auth.getSession.mockResolvedValue({
 *   data: { session: createFakeSession() },
 *   error: null,
 * });
 * mockSupabase._setQueryResult("user_roles", { data: { role: "patient" } });
 * ```
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  const queryResults = new Map<string, { data: any; error: any }>();
  let authChangeCallback: AuthChangeCallback | null = null;

  const client: MockSupabaseClient = {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),

      onAuthStateChange: vi.fn((callback: AuthChangeCallback) => {
        authChangeCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      }),

      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ data: { user: null, session: null }, error: null }),

      signUp: vi
        .fn()
        .mockResolvedValue({ data: { user: null, session: null }, error: null }),

      signOut: vi.fn().mockResolvedValue({ error: null }),
    },

    from: vi.fn((table: string) => {
      const result = queryResults.get(table) ?? { data: null, error: null };
      return createMockQueryBuilder(result);
    }),

    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },

    _triggerAuthChange(event: string, session: Session | null) {
      authChangeCallback?.(event, session);
    },

    _setQueryResult(table: string, result: { data?: any; error?: any }) {
      queryResults.set(table, {
        data: result.data ?? null,
        error: result.error ?? null,
      });
    },

    _reset() {
      queryResults.clear();
      authChangeCallback = null;
    },
  };

  return client;
}
