import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetGithubRepos } from "@/cross-modules/deployment/hooks/use-github-info";
import { githubInfoService } from "@/cross-modules/deployment/services/github-info.service";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGetGithubRepos: vi.fn(),
}));
vi.mock("@/cross-modules/deployment/services/github-info.service", () => ({
  githubInfoService: { revokeAccess: vi.fn().mockResolvedValue({}) },
}));

import { RepositorySelectionModal } from "./repository-selection-modal";

const repoItem = {
  id: 1,
  name: "app",
  full_name: "acme/app",
  html_url: "https://github.com/acme/app",
};

describe("RepositorySelectionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetGithubRepos).mockReturnValue({
      data: { data: { items: [repoItem], total_count: 1 } },
      isLoading: false,
      isFetching: false,
    } as never);
    // jsdom does not implement navigation; stub reload so handleConfirm runs.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: vi.fn() },
    });
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
    expect(screen.getByText(/1 results/)).toBeInTheDocument();
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

  it("selects a repository and confirms via Add", async () => {
    const onSelectRepository = vi.fn();
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={onSelectRepository}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("acme/app"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSelectRepository).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it("shows an error when the repository is already selected", async () => {
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
        selectedRepositories={[repoItem as never]}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("acme/app"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(
      screen.getByText("Repository already selected."),
    ).toBeInTheDocument();
  });

  it("closes the modal when Cancel is clicked", () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={onOpenChange}
        onSelectRepository={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens the revoke access confirmation and revokes on confirm", async () => {
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Revoke repository access"));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(githubInfoService.revokeAccess).toHaveBeenCalled(),
    );
  });

  it("updates the search field value", () => {
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const search = screen.getByPlaceholderText("Search repositories...");
    fireEvent.change(search, { target: { value: "app" } });
    expect(search).toHaveValue("app");
  });

  it("loads more repositories on scroll and wheel near the bottom", async () => {
    const items = Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      name: `app${i}`,
      full_name: `acme/app${i}`,
      html_url: `https://github.com/acme/app${i}`,
    }));
    vi.mocked(useGetGithubRepos).mockReturnValue({
      data: { data: { items, total_count: 40 } },
      isLoading: false,
      isFetching: false,
    } as never);
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const list = await screen.findByText("acme/app0");
    const scrollContainer = list.closest("[class*='overflow-y-auto']")
      ?.parentElement as HTMLElement;
    const target = scrollContainer || (list.parentElement as HTMLElement);
    Object.defineProperty(target, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(target, "clientHeight", {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(target, "scrollTop", {
      value: 800,
      configurable: true,
    });
    fireEvent.scroll(target);
    fireEvent.wheel(target, { deltaY: 100 });
    expect(target).toBeInTheDocument();
  });

  it("renders the empty state when no repositories are returned", () => {
    vi.mocked(useGetGithubRepos).mockReturnValue({
      data: { data: { items: [], total_count: 0 } },
      isLoading: false,
      isFetching: false,
    } as never);
    renderWithProviders(
      <RepositorySelectionModal
        open
        onOpenChange={vi.fn()}
        onSelectRepository={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("No repositories found.")).toBeInTheDocument();
  });
});
