import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn()", () => {
  it("combina múltiples clases correctamente", () => {
    expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
  });

  it("resuelve conflictos de Tailwind manteniendo la última clase", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("mx-2", "mx-4")).toBe("mx-4");
  });

  it("maneja valores undefined sin romper", () => {
    expect(cn("text-red-500", undefined)).toBe("text-red-500");
  });

  it("maneja valores null sin romper", () => {
    expect(cn("text-red-500", null)).toBe("text-red-500");
  });

  it("maneja valores false sin romper", () => {
    expect(cn("text-red-500", false)).toBe("text-red-500");
  });

  it("maneja valores vacíos y retorna string vacío", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });

  it("funciona con clases condicionales", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe(
      "base active",
    );
  });

  it("combina clases de un array", () => {
    expect(cn(["text-red-500", "bg-blue-500"])).toBe(
      "text-red-500 bg-blue-500",
    );
  });

  it("combina clases de un objeto condicional", () => {
    expect(cn({ "text-red-500": true, "bg-blue-500": false })).toBe(
      "text-red-500",
    );
  });

  it("resuelve conflictos entre múltiples variantes de Tailwind", () => {
    expect(cn("rounded-sm", "rounded-lg")).toBe("rounded-lg");
    expect(cn("font-bold", "font-light")).toBe("font-light");
    expect(cn("border-2", "border-4")).toBe("border-4");
  });
});
