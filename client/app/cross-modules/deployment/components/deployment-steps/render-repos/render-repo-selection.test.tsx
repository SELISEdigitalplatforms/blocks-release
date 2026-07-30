import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGithubBranches } from "@/cross-modules/deployment/hooks/use-github-info";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGithubBranches: vi.fn(),
}));

import RepositorySelector from "./render-repo-selection";

const repositories = [
  { id: 1, full_name: "acme/app", html_url: "https://github.com/acme/app" },
  { id: 2, full_name: "acme/api", html_url: "https://github.com/acme/api" },
] as never;

describe("RepositorySelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGithubBranches).mockReturnValue({ data: [] } as never);
  });

  it("shows the empty message when there are no repositories", () => {
    renderWithProviders(
      <RepositorySelector
        repositories={undefined}
        selectedRepo={null}
        selectedBranch={null}
        onRepoSelect={vi.fn()}
        onBranchSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("No repositories available")).toBeInTheDocument();
  });

  it("selects a repository and resets the branch", async () => {
    const onRepoSelect = vi.fn();
    const onBranchSelect = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <RepositorySelector
        repositories={repositories}
        selectedRepo={null}
        selectedBranch={null}
        onRepoSelect={onRepoSelect}
        onBranchSelect={onBranchSelect}
      />,
    );
    await user.click(screen.getByText("Select repository"));
    fireEvent.click(await screen.findByText("acme/api"));
    expect(onRepoSelect).toHaveBeenCalledWith(
      "acme/api",
      "https://github.com/acme/api",
    );
    expect(onBranchSelect).toHaveBeenCalledWith(null);
  });

  it("filters repositories by the search field", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <RepositorySelector
        repositories={repositories}
        selectedRepo={null}
        selectedBranch={null}
        onRepoSelect={vi.fn()}
        onBranchSelect={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Select repository"));
    const search = await screen.findByPlaceholderText("Search repository...");
    fireEvent.change(search, { target: { value: "api" } });
    expect(screen.getByText("acme/api")).toBeInTheDocument();
    expect(screen.queryByText("acme/app")).not.toBeInTheDocument();
  });

  it("selects a branch from the branch dropdown", async () => {
    const onBranchSelect = vi.fn();
    vi.mocked(useGithubBranches).mockReturnValue({
      data: [{ name: "develop", commit: { sha: "", url: "" } }],
    } as never);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(
      <RepositorySelector
        repositories={repositories}
        selectedRepo="acme/app"
        selectedBranch={null}
        onRepoSelect={vi.fn()}
        onBranchSelect={onBranchSelect}
      />,
    );
    await user.click(screen.getByText("Select branch"));
    fireEvent.click(await screen.findByText("develop"));
    expect(onBranchSelect).toHaveBeenCalledWith("develop");
  });
});
