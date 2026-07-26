import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyableSnippet } from "./copyable-snippet";

describe("CopyableSnippet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the code and copies it to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyableSnippet code="npm install" isCopyable />);
    fireEvent.click(screen.getByLabelText("Copy code"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("npm install"));
  });

  it("falls back to execCommand when the clipboard API is unavailable", async () => {
    Object.assign(navigator, { clipboard: undefined });
    const execCommand = vi.fn();
    (document as unknown as { execCommand: typeof execCommand }).execCommand =
      execCommand;
    render(<CopyableSnippet code="echo hi" isCopyable />);
    fireEvent.click(screen.getByLabelText("Copy code"));
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
  });

  it("hides the copy button when not copyable", () => {
    render(<CopyableSnippet code="secret" isCopyable={false} />);
    expect(screen.queryByLabelText("Copy code")).not.toBeInTheDocument();
  });
});
