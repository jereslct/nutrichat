import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NavLink } from "../NavLink";

function renderNavLink(
  props: React.ComponentProps<typeof NavLink>,
  initialEntry = "/",
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavLink {...props} />
    </MemoryRouter>,
  );
}

describe("NavLink", () => {
  it("renderiza como link con el texto correcto", () => {
    renderNavLink({ to: "/chat", children: "Chat" });

    const link = screen.getByRole("link", { name: "Chat" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/chat");
  });

  it("aplica className base", () => {
    renderNavLink({ to: "/chat", className: "nav-item", children: "Chat" });

    expect(screen.getByRole("link")).toHaveClass("nav-item");
  });

  it("aplica activeClassName cuando la ruta está activa", () => {
    renderNavLink(
      { to: "/chat", className: "nav-item", activeClassName: "active", children: "Chat" },
      "/chat",
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("nav-item");
    expect(link).toHaveClass("active");
  });

  it("no aplica activeClassName cuando la ruta NO está activa", () => {
    renderNavLink(
      { to: "/chat", className: "nav-item", activeClassName: "active", children: "Chat" },
      "/upload",
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("nav-item");
    expect(link).not.toHaveClass("active");
  });

  it("pasa props adicionales correctamente", () => {
    renderNavLink({
      to: "/profile",
      "aria-label": "Ir al perfil",
      "data-testid": "profile-link",
      children: "Perfil",
    });

    const link = screen.getByTestId("profile-link");
    expect(link).toHaveAttribute("aria-label", "Ir al perfil");
  });
});
