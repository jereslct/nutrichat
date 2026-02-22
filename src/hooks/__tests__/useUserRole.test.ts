import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabaseClient } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabaseClient() };
});

import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "../useUserRole";
import { createFakeSession } from "@/test/mocks/supabase";

const mockSupabase = supabase as unknown as MockSupabaseClient;

const fakeProfile = {
  full_name: "Test User",
  avatar_url: null,
  licenses_count: 0,
  plan_tier: "free",
};

describe("useUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("retorna loading=true inicialmente", () => {
    const { result } = renderHook(() => useUserRole());
    expect(result.current.loading).toBe(true);
  });

  it("sin sesión: retorna user=null, role=null, loading=false", async () => {
    const { result } = renderHook(() => useUserRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it("con sesión de paciente: retorna role='patient' y datos del perfil", async () => {
    const session = createFakeSession({ user: { id: "user-123" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "patient" } });
    mockSupabase._setQueryResult("profiles", { data: fakeProfile });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.id).toBe("user-123");
    expect(result.current.role).toBe("patient");
    expect(result.current.profile).toEqual(fakeProfile);
  });

  it("con sesión de doctor: retorna role='doctor'", async () => {
    const session = createFakeSession({ user: { id: "doc-1" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "doctor" } });
    mockSupabase._setQueryResult("profiles", {
      data: { ...fakeProfile, full_name: "Dr. Smith", plan_tier: "pro" },
    });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.role).toBe("doctor");
  });

  it("en SIGNED_OUT: limpia el estado", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "patient" } });
    mockSupabase._setQueryResult("profiles", { data: fakeProfile });

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.role).toBe("patient");

    act(() => {
      mockSupabase._triggerAuthChange("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });

    expect(result.current.role).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it("maneja errores en getSession y retorna estado limpio", async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useUserRole());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
  });
});
