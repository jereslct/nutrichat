import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabaseClient } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabaseClient() };
});

import { supabase } from "@/integrations/supabase/client";
import { createFakeSession } from "@/test/mocks/supabase";
import ProtectedRoute from "../ProtectedRoute";

const mockSupabase = supabase as unknown as MockSupabaseClient;

function renderWithRouter(
  ui: React.ReactElement,
  { initialEntry = "/protected" } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/register" element={<p>Register Page</p>} />
        <Route path="/" element={<p>Home Page</p>} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("muestra spinner de carga mientras verifica autenticación", () => {
    mockSupabase.auth.getSession.mockReturnValue(new Promise(() => {}));

    renderWithRouter(
      <ProtectedRoute>
        <p>Contenido protegido</p>
      </ProtectedRoute>,
    );

    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("redirige a /register cuando no hay sesión", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <p>Contenido protegido</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Register Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });

  it("renderiza children cuando el usuario está autenticado (sin requiredRole)", async () => {
    const session = createFakeSession({ user: { id: "u1" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <p>Contenido protegido</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    });
  });

  it("renderiza children cuando el usuario tiene el rol 'doctor' requerido", async () => {
    const session = createFakeSession({ user: { id: "doc-1" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "doctor" } });

    renderWithRouter(
      <ProtectedRoute requiredRole="doctor">
        <p>Dashboard Doctor</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard Doctor")).toBeInTheDocument();
    });
  });

  it("redirige a / cuando el usuario no tiene el rol 'doctor' requerido", async () => {
    const session = createFakeSession({ user: { id: "u1" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "patient" } });

    renderWithRouter(
      <ProtectedRoute requiredRole="doctor">
        <p>Dashboard Doctor</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Dashboard Doctor")).not.toBeInTheDocument();
  });

  it("permite acceso admin al super admin por email", async () => {
    const session = createFakeSession({
      user: { id: "admin-1", email: "admin@nutrichat.com" },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="admin">
        <p>Panel Admin</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Panel Admin")).toBeInTheDocument();
    });
  });

  it("permite acceso admin al usuario con rol super_admin en DB", async () => {
    const session = createFakeSession({
      user: { id: "admin-2", email: "otro@example.com" },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", {
      data: { role: "super_admin" },
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="admin">
        <p>Panel Admin</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Panel Admin")).toBeInTheDocument();
    });
  });

  it("redirige a / cuando un usuario normal intenta acceder a ruta admin", async () => {
    const session = createFakeSession({
      user: { id: "u1", email: "user@example.com" },
    });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "patient" } });

    renderWithRouter(
      <ProtectedRoute requiredRole="admin">
        <p>Panel Admin</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    expect(screen.queryByText("Panel Admin")).not.toBeInTheDocument();
  });

  it("redirige a /register en SIGNED_OUT", async () => {
    const session = createFakeSession({ user: { id: "u1" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <p>Contenido protegido</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    });

    act(() => {
      mockSupabase._triggerAuthChange("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(screen.getByText("Register Page")).toBeInTheDocument();
    });
  });

  it("redirige a / cuando no hay rol en DB (null) y se requiere doctor", async () => {
    const session = createFakeSession({ user: { id: "u1" } });
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: null });

    renderWithRouter(
      <ProtectedRoute requiredRole="doctor">
        <p>Dashboard Doctor</p>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });
});
