import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reducer } from "../use-toast";

type ToasterToast = {
  id: string;
  title?: string;
  description?: string;
  open?: boolean;
};

type State = { toasts: ToasterToast[] };

const emptyState: State = { toasts: [] };

function makeToast(overrides: Partial<ToasterToast> = {}): ToasterToast {
  return { id: "1", title: "Test toast", open: true, ...overrides };
}

describe("use-toast reducer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ADD_TOAST", () => {
    it("agrega un toast al estado vacío", () => {
      const toast = makeToast();
      const next = reducer(emptyState, { type: "ADD_TOAST", toast });

      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0]).toEqual(toast);
    });

    it("agrega el nuevo toast al inicio del array", () => {
      const existing = makeToast({ id: "old", title: "Old" });
      const incoming = makeToast({ id: "new", title: "New" });

      const next = reducer(
        { toasts: [existing] },
        { type: "ADD_TOAST", toast: incoming },
      );

      expect(next.toasts[0].id).toBe("new");
    });

    it("respeta TOAST_LIMIT (máximo 1 toast)", () => {
      const existing = makeToast({ id: "old" });
      const incoming = makeToast({ id: "new" });

      const next = reducer(
        { toasts: [existing] },
        { type: "ADD_TOAST", toast: incoming },
      );

      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe("new");
    });

    it("no muta el estado original", () => {
      const state: State = { toasts: [] };
      reducer(state, { type: "ADD_TOAST", toast: makeToast() });

      expect(state.toasts).toHaveLength(0);
    });
  });

  describe("UPDATE_TOAST", () => {
    it("actualiza un toast existente por id", () => {
      const state: State = { toasts: [makeToast({ id: "1", title: "Original" })] };

      const next = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Actualizado" },
      });

      expect(next.toasts[0].title).toBe("Actualizado");
    });

    it("mantiene propiedades no incluidas en el update", () => {
      const state: State = {
        toasts: [makeToast({ id: "1", title: "Original", description: "Desc" })],
      };

      const next = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Nuevo título" },
      });

      expect(next.toasts[0].title).toBe("Nuevo título");
      expect(next.toasts[0].description).toBe("Desc");
    });

    it("no modifica toasts con id diferente", () => {
      const state: State = {
        toasts: [makeToast({ id: "1", title: "Uno" })],
      };

      const next = reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "999", title: "Otro" },
      });

      expect(next.toasts[0].title).toBe("Uno");
    });

    it("no muta el estado original", () => {
      const original = makeToast({ id: "1", title: "Original" });
      const state: State = { toasts: [original] };

      reducer(state, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Nuevo" },
      });

      expect(state.toasts[0].title).toBe("Original");
    });
  });

  describe("DISMISS_TOAST", () => {
    it("marca un toast específico como cerrado (open: false)", () => {
      const state: State = {
        toasts: [makeToast({ id: "1", open: true })],
      };

      const next = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });

      expect(next.toasts[0].open).toBe(false);
    });

    it("marca todos los toasts como cerrados si no se pasa id", () => {
      const state: State = {
        toasts: [makeToast({ id: "1", open: true })],
      };

      const next = reducer(state, { type: "DISMISS_TOAST" });

      expect(next.toasts.every((t) => t.open === false)).toBe(true);
    });

    it("no afecta toasts con id diferente al especificado", () => {
      const state: State = {
        toasts: [makeToast({ id: "1", open: true })],
      };

      const next = reducer(state, { type: "DISMISS_TOAST", toastId: "other" });

      expect(next.toasts[0].open).toBe(true);
    });

    it("no muta el estado original", () => {
      const state: State = {
        toasts: [makeToast({ id: "1", open: true })],
      };

      reducer(state, { type: "DISMISS_TOAST", toastId: "1" });

      expect(state.toasts[0].open).toBe(true);
    });
  });

  describe("REMOVE_TOAST", () => {
    it("elimina un toast por id", () => {
      const state: State = {
        toasts: [makeToast({ id: "1" })],
      };

      const next = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });

      expect(next.toasts).toHaveLength(0);
    });

    it("elimina todos los toasts si no se pasa id", () => {
      const state: State = {
        toasts: [makeToast({ id: "1" })],
      };

      const next = reducer(state, { type: "REMOVE_TOAST" });

      expect(next.toasts).toHaveLength(0);
    });

    it("no elimina toasts con id diferente", () => {
      const state: State = {
        toasts: [makeToast({ id: "1" })],
      };

      const next = reducer(state, { type: "REMOVE_TOAST", toastId: "999" });

      expect(next.toasts).toHaveLength(1);
      expect(next.toasts[0].id).toBe("1");
    });

    it("no muta el estado original", () => {
      const state: State = {
        toasts: [makeToast({ id: "1" })],
      };

      reducer(state, { type: "REMOVE_TOAST", toastId: "1" });

      expect(state.toasts).toHaveLength(1);
    });
  });
});
