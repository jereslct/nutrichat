import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Chat from "../Chat";
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

function setupSessionWithDiet() {
  const session = createFakeSession();
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session },
    error: null,
  });
  mockSupabase._setQueryResult("profiles", {
    data: { avatar_url: null, full_name: "Test User" },
  });
  mockSupabase._setQueryResult("diets", {
    data: { id: "diet-1", file_name: "dieta.pdf", created_at: "2025-01-01" },
  });
  mockSupabase._setQueryResult("chat_messages", { data: [] });
  return session;
}

function renderChat(initialEntry = "/chat") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Chat />
    </MemoryRouter>,
  );
}

describe("Chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("redirige a /register si no hay sesión", async () => {
    renderChat();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/register");
    });
  });

  it("renderiza interfaz de chat cuando hay sesión y dieta", async () => {
    setupSessionWithDiet();
    renderChat();

    await waitFor(() => {
      expect(
        screen.getByText("Hola, soy tu asistente nutricional"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText("Escribe tu pregunta..."),
    ).toBeInTheDocument();
  });

  it("muestra sugerencias de preguntas en chat vacío", async () => {
    setupSessionWithDiet();
    renderChat();

    await waitFor(() => {
      expect(
        screen.getByText("¿Qué puedo comer de colación?"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("¿Puedo sustituir este alimento?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("¿Cuánta agua debo beber?"),
    ).toBeInTheDocument();
  });

  it("maneja status=success en URL", async () => {
    setupSessionWithDiet();
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderChat("/chat?status=success");

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/chat");
    });

    replaceStateSpy.mockRestore();
  });

  it("maneja status=failure en URL", async () => {
    setupSessionWithDiet();
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderChat("/chat?status=failure");

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/chat");
    });

    replaceStateSpy.mockRestore();
  });

  it("maneja status=pending en URL", async () => {
    setupSessionWithDiet();
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    renderChat("/chat?status=pending");

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith({}, "", "/chat");
    });

    replaceStateSpy.mockRestore();
  });

  it("redirige a /upload si no hay dieta cargada", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("profiles", {
      data: { avatar_url: null, full_name: "Test User" },
    });
    mockSupabase._setQueryResult("diets", { data: null });

    renderChat();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/upload");
    });
  });
});
