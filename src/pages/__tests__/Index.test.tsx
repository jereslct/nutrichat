import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Index from "../Index";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderIndex() {
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

describe("Index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza landing page con hero section", () => {
    renderIndex();

    expect(screen.getByText(/Tu dieta no falla por falta de voluntad/)).toBeInTheDocument();
    expect(screen.getByText(/organización/)).toBeInTheDocument();
  });

  it("muestra CTA principal", () => {
    renderIndex();

    expect(
      screen.getByRole("button", { name: /Convertir mi PDF en Acción/ }),
    ).toBeInTheDocument();
  });

  it("contiene botón de Iniciar Sesión que navega a registro", async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/ }));

    expect(mockNavigate).toHaveBeenCalledWith("/register");
  });

  it("CTA principal navega a registro", async () => {
    const user = userEvent.setup();
    renderIndex();

    await user.click(
      screen.getByRole("button", { name: /Convertir mi PDF en Acción/ }),
    );

    expect(mockNavigate).toHaveBeenCalledWith("/register");
  });

  it("muestra botón 'Comenzar Gratis'", () => {
    renderIndex();

    expect(
      screen.getByRole("button", { name: /Comenzar Gratis/ }),
    ).toBeInTheDocument();
  });
});
