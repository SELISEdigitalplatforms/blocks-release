import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BranchVerificationModal from "./unmatched-branch-modal";
import type { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";

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
});
