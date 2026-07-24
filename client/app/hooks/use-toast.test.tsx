import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  reducer,
  showErrorToast,
  showInfoToast,
  showSuccessToast,
  toast,
  useToast,
} from "./use-toast";

type ToastItem = Parameters<typeof reducer>[0]["toasts"][number];

const makeToast = (id: string): ToastItem =>
  ({ id, open: true, title: id }) as ToastItem;

describe("toast reducer", () => {
  it("ADD_TOAST keeps only the most recent toast (limit 1)", () => {
    let state = { toasts: [] as ToastItem[] };
    state = reducer(state, { type: "ADD_TOAST", toast: makeToast("1") });
    state = reducer(state, { type: "ADD_TOAST", toast: makeToast("2") });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe("2");
  });

  it("UPDATE_TOAST merges into a matching toast", () => {
    const state = reducer(
      { toasts: [makeToast("1")] },
      { type: "UPDATE_TOAST", toast: { id: "1", title: "updated" } },
    );
    expect(state.toasts[0].title).toBe("updated");
  });

  it("DISMISS_TOAST closes a specific toast", () => {
    const state = reducer(
      { toasts: [makeToast("1")] },
      { type: "DISMISS_TOAST", toastId: "1" },
    );
    expect(state.toasts[0].open).toBe(false);
  });

  it("DISMISS_TOAST with no id closes all toasts", () => {
    const state = reducer(
      { toasts: [makeToast("1")] },
      { type: "DISMISS_TOAST" },
    );
    expect(state.toasts[0].open).toBe(false);
  });

  it("REMOVE_TOAST clears all when no id is given", () => {
    const state = reducer(
      { toasts: [makeToast("1")] },
      { type: "REMOVE_TOAST", toastId: undefined },
    );
    expect(state.toasts).toHaveLength(0);
  });

  it("REMOVE_TOAST removes a specific toast", () => {
    const state = reducer(
      { toasts: [makeToast("1"), makeToast("2")] },
      { type: "REMOVE_TOAST", toastId: "1" },
    );
    expect(state.toasts.map((t) => t.id)).toEqual(["2"]);
  });
});

describe("toast api", () => {
  it("toast() surfaces through the useToast hook", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Hi" });
    });
    expect(result.current.toasts[0]?.title).toBe("Hi");
  });

  it("toast() returns update and dismiss handles", () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast>;
    act(() => {
      handle = toast({ title: "One" });
    });
    act(() => handle.update({ id: handle.id, title: "Two" } as never));
    expect(result.current.toasts[0]?.title).toBe("Two");
    act(() => handle.dismiss());
    expect(result.current.toasts[0]?.open).toBe(false);
  });

  it("hook dismiss closes the current toast", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Closable" });
    });
    act(() => result.current.dismiss());
    expect(result.current.toasts[0]?.open).toBe(false);
  });

  it("showSuccessToast and showInfoToast emit variants", () => {
    const { result } = renderHook(() => useToast());
    act(() => showSuccessToast({ description: "done" }));
    expect(result.current.toasts[0]?.variant).toBe("success");
    act(() => showInfoToast({ description: "fyi" }));
    expect(result.current.toasts[0]?.variant).toBe("info");
  });

  it("showErrorToast renders a string message", () => {
    const { result } = renderHook(() => useToast());
    act(() => showErrorToast({ errors: "bad" }));
    expect(result.current.toasts[0]?.variant).toBe("destructive");
    expect(result.current.toasts[0]?.description).toBe("bad");
  });

  it("showErrorToast renders a list of messages", () => {
    const { result } = renderHook(() => useToast());
    act(() => showErrorToast({ errors: { a: "one", b: "two" } }));
    expect(Array.isArray(result.current.toasts[0]?.description)).toBe(true);
  });
});
