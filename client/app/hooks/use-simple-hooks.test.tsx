import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBoolean } from "./use-boolean";
import { useDebounce } from "./use-debounce";
import { useCountDown } from "./use-count-down";
import useIsMobile from "./use-is-mobile";
import useLanguage from "./use-language-switcher";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

describe("useBoolean", () => {
  it("toggles and sets values", () => {
    const { result } = renderHook(() => useBoolean());
    expect(result.current.value).toBe(false);
    act(() => result.current.setTrue());
    expect(result.current.value).toBe(true);
    act(() => result.current.setFalse());
    expect(result.current.value).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.value).toBe(true);
    act(() => result.current.setValue(false));
    expect(result.current.value).toBe(false);
  });

  it("honors an initial value", () => {
    const { result } = renderHook(() => useBoolean(true));
    expect(result.current.value).toBe(true);
  });
});

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delays the value update", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "a" } },
    );
    expect(result.current).toBe("a");
    rerender({ value: "b" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe("b");
  });
});

describe("useCountDown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ticks down each second and resets", () => {
    const { result } = renderHook(() => useCountDown(3));
    expect(result.current.remainingTime).toBe(3);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingTime).toBe(2);
    act(() => result.current.reset(10));
    expect(result.current.remainingTime).toBe(10);
    act(() => result.current.reset());
    expect(result.current.remainingTime).toBe(3);
  });

  it("does nothing when starting at zero", () => {
    const { result } = renderHook(() => useCountDown(0));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.remainingTime).toBe(0);
  });
});

describe("useIsMobile", () => {
  it("reflects the window width against the breakpoint", () => {
    window.innerWidth = 500;
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(true);
    act(() => {
      window.innerWidth = 1200;
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });
});

describe("useLanguage", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to en and persists changes", () => {
    const { result } = renderHook(() => useLanguage());
    expect(result.current.language).toBe("en");
    act(() => result.current.changeLanguage("de"));
    expect(result.current.language).toBe("de");
    expect(localStorage.getItem("language")).toBe("de");
  });
});

describe("useCopyToClipboard", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes to the clipboard and calls onSuccess", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("hello", onSuccess);
    });
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(onSuccess).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
  });

  it("reports an error when the clipboard api is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("x", undefined, onError);
    });
    expect(onError).toHaveBeenCalled();
  });

  it("reports an error when writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy("x", undefined, onError);
    });
    expect(onError).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
  });
});
