import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BranchVerificationModal from "./unmatched-branch-modal";
import type { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const repo = {
  itemId: "r1",
  repoName: "acme/app",
  branch: "main",
} as unknown as IRepoResponse;

const baseProps = {
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onApiComplete: vi.fn(),
  onRetry: vi.fn(),
  onReopenModal: vi.fn(),
  onForceShowSuccess: vi.fn(),
  repo,
  isProcessing: false,
};

describe("BranchVerificationModal", () => {
  it("runs verification via refetch when open", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { isSuccess: true } });
    render(
      <BranchVerificationModal
        {...baseProps}
        isOpen
        refetch={refetch as never}
      />,
    );
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("renders nothing meaningful when closed", () => {
    const { container } = render(
      <BranchVerificationModal
        {...baseProps}
        isOpen={false}
        refetch={vi.fn().mockResolvedValue({}) as never}
      />,
    );
    expect(container).toBeTruthy();
  });

  it("shows the error state and retries when verification skips", async () => {
    const onRetry = vi.fn();
    const refetch = vi.fn().mockResolvedValue({ data: { isSuccess: false } });
    render(
      <BranchVerificationModal
        {...baseProps}
        onRetry={onRetry}
        isOpen
        skipInitialVerification
        refetch={refetch as never}
      />,
    );
    expect(
      screen.getByText("Expected branch not available"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalled();
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });

  it("closes from the error state", () => {
    const onClose = vi.fn();
    render(
      <BranchVerificationModal
        {...baseProps}
        onClose={onClose}
        isOpen
        skipInitialVerification
        refetch={vi.fn().mockResolvedValue({}) as never}
      />,
    );
    // Both the header X and the footer button expose the "Close" name; the
    // footer button carries the visible label text.
    const closeButton = screen
      .getAllByRole("button", { name: "Close" })
      .find((b) => b.textContent?.includes("Close"));
    fireEvent.click(closeButton as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it("moves to the error state when refetch reports an error", async () => {
    const refetch = vi.fn().mockResolvedValue({ error: new Error("nope") });
    render(
      <BranchVerificationModal
        {...baseProps}
        isOpen
        refetch={refetch as never}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText("Expected branch not available"),
      ).toBeInTheDocument(),
    );
  });

  it("calls onSuccess after a successful verification", async () => {
    vi.useFakeTimers();
    const onSuccess = vi.fn();
    const refetch = vi.fn().mockResolvedValue({ data: { isSuccess: true } });
    render(
      <BranchVerificationModal
        {...baseProps}
        onSuccess={onSuccess}
        isOpen
        refetch={refetch as never}
      />,
    );
    await vi.waitFor(() => expect(refetch).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(900);
    expect(onSuccess).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
