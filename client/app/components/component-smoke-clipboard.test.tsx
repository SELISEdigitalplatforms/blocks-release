import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyToClipboardButton } from "./copy-to-clipboard-button/copy-to-clipboard-button";
import { CopyableSnippet } from "./copyable-snippet/copyable-snippet";

describe("clipboard components", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("CopyToClipboardButton copies via the clipboard API", async () => {
    render(
      <CopyToClipboardButton textToCopy="secret">
        <span>label</span>
      </CopyToClipboardButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("secret"),
    );
  });

  it("CopyToClipboardButton falls back to execCommand when insecure", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    document.execCommand = vi.fn().mockReturnValue(true);
    render(
      <CopyToClipboardButton textToCopy="fallback" isHoverable>
        <span>label</span>
      </CopyToClipboardButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(document.execCommand).toHaveBeenCalledWith("copy"));
  });

  it("CopyableSnippet renders code and copies on click", async () => {
    const { container } = render(
      <CopyableSnippet code="npm test" language="bash" isCopyable />,
    );
    expect(container.textContent).toContain("npm test");
    fireEvent.click(screen.getByLabelText("Copy code"));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("npm test"),
    );
  });

  it("CopyableSnippet hides the copy button when not copyable", () => {
    render(<CopyableSnippet code="ls" isCopyable={false} />);
    expect(screen.queryByLabelText("Copy code")).not.toBeInTheDocument();
  });
});
