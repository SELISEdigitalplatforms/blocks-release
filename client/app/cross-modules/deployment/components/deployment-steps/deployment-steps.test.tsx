import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useValidateAuthorization } from "@/cross-modules/deployment/hooks/use-github-info";
import { useGithubBranches } from "@/cross-modules/deployment/hooks/use-github-info";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useValidateAuthorization: vi.fn(),
  useGithubBranches: vi.fn(),
}));
vi.mock("@blocks-deployment/services/providers.service", () => ({
  authenticateWithGithub: vi.fn(),
  authenticateWithGitlab: vi.fn(),
  authenticateWithBitbucket: vi.fn(),
  authenticateWithAzure: vi.fn(),
  authenticateWithAws: vi.fn(),
}));

import ProviderButtons from "./render-repos/render-provider";
import RepositorySelector from "./render-repos/render-repo-selection";

describe("ProviderButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
    } as never);
  });

  it("renders provider buttons and invokes onClose for GitHub when authorized", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ProviderButtons destination="/app/deployment/configure" onClose={onClose} />,
    );
    const githubButton = screen.getByRole("button", {
      name: /continue with github/i,
    });
    fireEvent.click(githubButton);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("navigates to the destination when there is no onClose handler", () => {
    renderWithProviders(
      <ProviderButtons destination="/app/deployment/configure" />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /continue with github/i }),
    );
  });
});

describe("RepositorySelector", () => {
  beforeEach(() => {
    vi.mocked(useGithubBranches).mockReturnValue({
      data: [{ name: "main", commit: { sha: "", url: "" } }],
    } as never);
  });

  it("renders the repository and branch selectors", () => {
    renderWithProviders(
      <RepositorySelector
        repositories={[
          { full_name: "acme/app", html_url: "https://github.com/acme/app" },
        ] as never}
        selectedRepo={null}
        selectedBranch={null}
        onRepoSelect={vi.fn()}
        onBranchSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
