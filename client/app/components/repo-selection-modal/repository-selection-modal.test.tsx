import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetGithubRepos } from "@/cross-modules/deployment/hooks/use-github-info";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGetGithubRepos: vi.fn(),
}));
vi.mock("@/cross-modules/deployment/services/github-info.service", () => ({
  githubInfoService: { revokeAccess: vi.fn().mockResolvedValue({}) },
}));

import { RepositorySelectionModal } from "./repository-selection-modal";

describe("RepositorySelectionModal", () => {
  beforeEach(() => {
    vi.mocked(useGetGithubRepos).mockReturnValue({
      data: {
        data: {
          items: [
            {
              id: 1,
              name: "app",
              full_name: "acme/app",
              html_url: "https://github.com/acme/app",
            },
          ],
          total_count: 1,
        },
      },
      isLoading: false,
      isFetching: false,
    } as never);
  });

  it("renders the dialog title when open", () => {
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );
    expect(screen.getByText("Select repository")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithProviders(
      <RepositorySelectionModal
        open={false}
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );
    expect(screen.queryByText("Select repository")).not.toBeInTheDocument();
  });
});
