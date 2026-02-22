import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PremiumModal } from "../PremiumModal";
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

function renderModal(open = true, onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...render(
      <MemoryRouter>
        <PremiumModal open={open} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    ),
  };
}

describe("PremiumModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("no muestra contenido cuando open=false", () => {
    renderModal(false);

    expect(screen.queryByText("¡Suscríbete a PRO!")).not.toBeInTheDocument();
  });

  it("muestra contenido cuando open=true", () => {
    renderModal(true);

    expect(screen.getByText("¡Suscríbete a PRO!")).toBeInTheDocument();
    expect(
      screen.getByText(/Has alcanzado tus 5 chats gratuitos/),
    ).toBeInTheDocument();
  });

  it("muestra la lista de beneficios PRO", () => {
    renderModal(true);

    expect(screen.getByText("Chats ilimitados con tu asistente")).toBeInTheDocument();
    expect(screen.getByText("Análisis de fotos ilimitado")).toBeInTheDocument();
    expect(screen.getByText("Soporte prioritario")).toBeInTheDocument();
    expect(screen.getByText("Cancela cuando quieras")).toBeInTheDocument();
  });

  it("muestra el precio", () => {
    renderModal(true);

    expect(screen.getByText(/\$16\.999/)).toBeInTheDocument();
    expect(screen.getByText(/\/mes/)).toBeInTheDocument();
  });

  it("llama onOpenChange al hacer clic en 'Quizás más tarde'", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal(true);

    await user.click(screen.getByRole("button", { name: /Quizás más tarde/ }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("navega a /subscription al hacer clic en 'Ver más detalles'", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal(true);

    await user.click(screen.getByRole("button", { name: /Ver más detalles/ }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith("/subscription");
  });

  it("muestra toast de error si no hay sesión al suscribirse", async () => {
    const user = userEvent.setup();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderModal(true);

    await user.click(screen.getByRole("button", { name: /Suscribirme ahora/ }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    });
  });

  it("invoca la Edge Function create-subscription con sesión válida", async () => {
    const user = userEvent.setup();
    const session = createFakeSession();

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: { init_point: "https://mercadopago.com/checkout/123" },
      error: null,
    });

    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    renderModal(true);

    await user.click(screen.getByRole("button", { name: /Suscribirme ahora/ }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        "create-subscription",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
    });

    expect(window.location.href).toBe("https://mercadopago.com/checkout/123");

    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it("muestra toast de error cuando la Edge Function falla", async () => {
    const user = userEvent.setup();
    const session = createFakeSession();

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("Server error"),
    });

    renderModal(true);

    await user.click(screen.getByRole("button", { name: /Suscribirme ahora/ }));

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });
  });

  it("muestra 'Procesando...' mientras se procesa la suscripción", async () => {
    const user = userEvent.setup();
    const session = createFakeSession();

    let resolveInvoke: (value: any) => void;
    const invokePromise = new Promise((resolve) => {
      resolveInvoke = resolve;
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase.functions.invoke.mockReturnValue(invokePromise);

    renderModal(true);

    await user.click(screen.getByRole("button", { name: /Suscribirme ahora/ }));

    await waitFor(() => {
      expect(screen.getByText("Procesando...")).toBeInTheDocument();
    });

    resolveInvoke!({ data: { init_point: "https://mp.com" }, error: null });
  });
});
