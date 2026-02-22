import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Upload from "../Upload";
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

function renderUpload() {
  return render(
    <MemoryRouter>
      <Upload />
    </MemoryRouter>,
  );
}

describe("Upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase._reset();
  });

  it("redirige a /register si no hay sesión", async () => {
    renderUpload();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/register");
    });
  });

  it("renderiza UI de carga cuando hay sesión", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderUpload();

    await waitFor(() => {
      expect(screen.getByText("Sube tu plan")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Carga tu plan nutricional en PDF/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Subir PDF/ }),
    ).toBeInTheDocument();
  });

  it("muestra dieta existente cuando hay una cargada", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockSupabase._setQueryResult("diets", {
      data: {
        id: "diet-1",
        file_name: "mi-dieta.pdf",
        created_at: "2025-01-15T10:00:00Z",
      },
    });

    renderUpload();

    await waitFor(() => {
      expect(screen.getByText("Tu plan está listo")).toBeInTheDocument();
    });
    expect(screen.getByText("mi-dieta.pdf")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Iniciar Chat/ }),
    ).toBeInTheDocument();
  });

  it("el input de archivo solo acepta PDF", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderUpload();

    await waitFor(() => {
      expect(screen.getByText("Sube tu plan")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toHaveAttribute("accept", ".pdf");
  });

  it("botón 'Subir PDF' está deshabilitado sin archivo seleccionado", async () => {
    const session = createFakeSession();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    renderUpload();

    await waitFor(() => {
      expect(screen.getByText("Sube tu plan")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Subir PDF/ })).toBeDisabled();
  });
});
