import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Register from "../Register";
import { supabase } from "@/integrations/supabase/client";
import type { MockSupabaseClient } from "@/test/mocks/supabase";
import { createFakeSession } from "@/test/mocks/supabase";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/integrations/supabase/client", async () => {
  const { createMockSupabaseClient } = await import("@/test/mocks/supabase");
  return { supabase: createMockSupabaseClient() };
});

const mockSupabase = supabase as unknown as MockSupabaseClient;

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

describe("Register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("renderiza formulario de login por defecto", () => {
    renderRegister();

    expect(screen.getByText("NutriChat")).toBeInTheDocument();
    expect(screen.getByText("Inicia sesión en tu cuenta")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Iniciar sesión/ }),
    ).toBeInTheDocument();
  });

  it("alterna entre login y registro", async () => {
    const user = userEvent.setup();
    renderRegister();

    expect(screen.getByText("Inicia sesión en tu cuenta")).toBeInTheDocument();

    await user.click(screen.getByText("¿No tienes cuenta? Regístrate"));
    expect(screen.getByText("Crea tu cuenta")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Crear cuenta/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("¿Ya tienes cuenta? Inicia sesión"));
    expect(screen.getByText("Inicia sesión en tu cuenta")).toBeInTheDocument();
  });

  it("muestra selector de rol solo en modo registro", async () => {
    const user = userEvent.setup();
    renderRegister();

    expect(screen.queryByText("Tipo de cuenta")).not.toBeInTheDocument();
    expect(screen.queryByText("Soy Paciente")).not.toBeInTheDocument();

    await user.click(screen.getByText("¿No tienes cuenta? Regístrate"));

    expect(screen.getByText("Tipo de cuenta")).toBeInTheDocument();
    expect(screen.getByText("Soy Paciente")).toBeInTheDocument();
    expect(screen.getByText("Soy Médico")).toBeInTheDocument();
  });

  it("validación: email inválido no llama signIn", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText("Email"), "invalid-email");
    await user.type(screen.getByLabelText("Contraseña"), "123456");
    await user.click(screen.getByRole("button", { name: /Iniciar sesión/ }));

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  it("validación: contraseña corta no llama signIn", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Contraseña"), "12345");
    await user.click(screen.getByRole("button", { name: /Iniciar sesión/ }));

    await waitFor(() => {
      expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  it("validación: nombre vacío en registro no llama signUp", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.click(screen.getByText("¿No tienes cuenta? Regístrate"));

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Contraseña"), "123456");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/ }));

    await waitFor(() => {
      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });
  });

  it("redirige a /chat si hay sesión de paciente con dieta", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "patient" } });
    mockSupabase._setQueryResult("diets", { data: [{ id: "diet-1" }] });

    renderRegister();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat");
    });
  });

  it("redirige a /dashboard si hay sesión de doctor", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("user_roles", { data: { role: "doctor" } });

    renderRegister();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});
