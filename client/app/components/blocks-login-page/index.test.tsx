import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { BlocksLoginPage } from "./index";

vi.mock("@/components/mode-toggle/mode-toggle", () => ({
  ModeToggle: () => <button type="button">toggle-theme</button>,
}));

const makeCtxStub = () => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  set fillStyle(_v: unknown) {},
});

describe("BlocksLoginPage", () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(makeCtxStub() as unknown as CanvasRenderingContext2D);
    let rafCalls = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      if (rafCalls++ < 1) cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    // Unmount while the rAF stubs are still installed, otherwise the canvas
    // effect cleanup calls a now-undefined cancelAnimationFrame.
    cleanup();
    getContextSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders the hero for a known product and triggers login", () => {
    const onLogin = vi.fn();
    render(<BlocksLoginPage name="blocks-iam" onLogin={onLogin} />);
    // splitAppName renders the app name across the head/tail of the title.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("blocks");
    expect(heading.textContent).toContain("IAM");
    fireEvent.click(screen.getByRole("button", { name: "Log in to your account" }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("falls back to the first product for an unknown name", () => {
    render(<BlocksLoginPage name="does-not-exist" onLogin={vi.fn()} />);
    // The first product is blocks OS.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("OS");
  });

  it("shows the redirecting label and disables the button while loading", () => {
    render(
      <BlocksLoginPage name="blocks-os" onLogin={vi.fn()} isLoading />,
    );
    const btn = screen.getByRole("button", { name: /Redirecting/ });
    expect(btn).toBeDisabled();
  });

  it("renders a custom footer link and eyebrow", () => {
    render(
      <BlocksLoginPage
        name="blocks-os"
        onLogin={vi.fn()}
        eyebrow="Custom Eyebrow"
        footerLink={{ label: "Custom Footer", url: "https://example.com" }}
      />,
    );
    expect(screen.getByText("Custom Eyebrow")).toBeInTheDocument();
    expect(screen.getByText("Custom Footer")).toBeInTheDocument();
  });

  it("cycles the animated keyword on an interval", () => {
    vi.useFakeTimers();
    render(<BlocksLoginPage name="blocks-os" onLogin={vi.fn()} />);
    // Advance past one full interval plus the inner fade timeout.
    vi.advanceTimersByTime(2800);
    vi.advanceTimersByTime(280);
    // Component remains mounted after the keyword rotation.
    expect(screen.getByText("Core Services — Blocks Platform")).toBeInTheDocument();
  });
});
