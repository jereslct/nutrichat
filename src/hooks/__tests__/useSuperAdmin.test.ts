import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabaseClient } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabaseClient() };
});

import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "../useSuperAdmin";
import { createFakeSession } from "@/test/mocks/supabase";

const mockSupabase = supabase as unknown as MockSupabaseClient;

describe("useSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("sin sesión: isSuperAdmin=false", async () => {
    const { result } = renderHook(() => useSuperAdmin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("con email admin@nutrichat.com: isSuperAdmin=true (sin consultar DB)", async () => {
    const session = createFakeSession({
      user: { email: "admin@nutrichat.com" },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const { result } = renderHook(() => useSuperAdmin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isSuperAdmin).toBe(true);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("con rol super_admin en DB: isSuperAdmin=true", async () => {
    const session = createFakeSession({
      user: { email: "other@example.com" },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", {
      data: { role: "super_admin" },
    });

    const { result } = renderHook(() => useSuperAdmin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isSuperAdmin).toBe(true);
  });

  it("con usuario común: isSuperAdmin=false", async () => {
    const session = createFakeSession({
      user: { email: "regular@example.com" },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", {
      data: { role: "patient" },
    });

    const { result } = renderHook(() => useSuperAdmin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.user).not.toBeNull();
  });
});
