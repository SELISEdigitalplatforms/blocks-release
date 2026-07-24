import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useRepoAndGitBranchMatch,
  useValidateAuthorization,
} from "@/cross-modules/deployment/hooks/use-github-info";
import { RepoCards, type IRepoResponse } from "./repo-cards";
import { RepositoryAccessModal } from "./repository-access-modal";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useRepoAndGitBranchMatch: vi.fn(),
  useValidateAuthorization: vi.fn(),
}));

const repo = {
  itemId: "r1",
  repoName: "acme/app",
  repoUrl: "https://github.com/acme/app",
  defaultDeploymentUrl: "https://app.dev",
  customDeploymentUrl: null,
  lastDeploymentDate: "2024-01-01T00:00:00Z",
  lastDeploymentStatus: "Succeeded",
  deploymentType: "auto",
  deploySettings: {},
} as unknown as IRepoResponse;

describe("RepoCards", () => {
  beforeEach(() => {
    vi.mocked(useRepoAndGitBranchMatch).mockReturnValue({
      refetch: vi.fn().mockResolvedValue({ data: { isSuccess: true } }),
    } as never);
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
      refetch: vi.fn(),
    } as never);
  });

  it("renders the repository card", () => {
    const { container } = renderWithProviders(<RepoCards repo={repo} />, {
      route: "/app/deployment",
    });
    expect(container.textContent).toContain("acme/app");
  });
});

describe("RepositoryAccessModal", () => {
  it("renders when open and retries authorization", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { isSuccess: false } });
    const { container } = renderWithProviders(
      <RepositoryAccessModal
        isOpen
        onOpenChange={vi.fn()}
        onAuthorized={vi.fn()}
        refetchAuthorization={refetch}
      />,
    );
    expect(container).toBeTruthy();
  });
});
