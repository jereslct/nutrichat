import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "../use-mobile";

type ChangeHandler = () => void;

function setupMatchMedia(innerWidth: number) {
  const listeners = new Set<ChangeHandler>();

  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: innerWidth,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: innerWidth < 768,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_: string, handler: ChangeHandler) => {
        listeners.add(handler);
      }),
      removeEventListener: vi.fn((_: string, handler: ChangeHandler) => {
        listeners.delete(handler);
      }),
      dispatchEvent: vi.fn(),
    })),
  });

  return {
    resize(newWidth: number) {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: newWidth,
      });
      listeners.forEach((fn) => fn());
    },
  };
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna true cuando window.innerWidth < 768", () => {
    setupMatchMedia(500);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("retorna false cuando window.innerWidth >= 768", () => {
    setupMatchMedia(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("reacciona a cambios de matchMedia (desktop → mobile)", () => {
    const mql = setupMatchMedia(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.resize(500);
    });

    expect(result.current).toBe(true);
  });

  it("reacciona a cambios de matchMedia (mobile → desktop)", () => {
    const mql = setupMatchMedia(400);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      mql.resize(1024);
    });

    expect(result.current).toBe(false);
  });
});
