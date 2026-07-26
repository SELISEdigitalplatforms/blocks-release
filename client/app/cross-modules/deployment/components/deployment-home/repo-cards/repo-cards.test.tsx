import { fireEvent, screen, waitFor } from "@testing-library/react";
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

  it("opens the branch verification modal when authorization succeeds", async () => {
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
      refetch: vi.fn().mockResolvedValue({ data: { isSuccess: true } }),
    } as never);
    renderWithProviders(<RepoCards repo={repo} />, { route: "/app/deployment" });
    fireEvent.click(screen.getByText(/Deploys for/));
    await waitFor(() =>
      expect(screen.getByText("Please wait…")).toBeInTheDocument(),
    );
  });

  it("opens the repository access modal when authorization fails", async () => {
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: false },
      refetch: vi.fn().mockResolvedValue({ data: { isSuccess: false } }),
    } as never);
    renderWithProviders(<RepoCards repo={repo} />, { route: "/app/deployment" });
    fireEvent.click(screen.getByText(/Deploys for/));
    await waitFor(() =>
      expect(screen.getByText("Repository access denied")).toBeInTheDocument(),
    );
  });

  it("ignores clicks that originate on a link inside the card", () => {
    const refetchAuthorization = vi.fn();
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: true },
      refetchAuthorization,
      refetch: refetchAuthorization,
    } as never);
    renderWithProviders(<RepoCards repo={repo} />, { route: "/app/deployment" });
    // Clicking the repo URL link should not start the auth check.
    fireEvent.click(screen.getByText("https://github.com/acme/app"));
    expect(refetchAuthorization).not.toHaveBeenCalled();
  });

  it("renders a custom deployment url and N/A repo url", () => {
    renderWithProviders(
      <RepoCards
        repo={
          {
            ...repo,
            repoUrl: "",
            defaultDeploymentUrl: null,
            customDeploymentUrl: "https://custom.example.com",
          } as never
        }
      />,
      { route: "/app/deployment" },
    );
    expect(
      screen.getByText("https://custom.example.com"),
    ).toBeInTheDocument();
  });

  it("proceeds to branch verification after a successful retry", async () => {
    const refetch = vi
      .fn()
      .mockResolvedValueOnce({ data: { isSuccess: false } })
      .mockResolvedValue({ data: { isSuccess: true } });
    vi.mocked(useValidateAuthorization).mockReturnValue({
      data: { isSuccess: false },
      refetch,
    } as never);
    renderWithProviders(<RepoCards repo={repo} />, { route: "/app/deployment" });
    fireEvent.click(screen.getByText(/Deploys for/));
    // Access modal opens; retry now authorizes and advances to the branch modal.
    fireEvent.click(await screen.findByRole("button", { name: /Retry/i }));
    await waitFor(() =>
      expect(screen.getByText("Please wait…")).toBeInTheDocument(),
    );
  });

  it("renders the no-build badge when no deployment status is present", () => {
    renderWithProviders(
      <RepoCards
        repo={{ ...repo, lastDeploymentStatus: null, deploymentType: "" } as never}
      />,
      { route: "/app/deployment" },
    );
    expect(screen.getByText("No build")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
  });
});

describe("RepositoryAccessModal", () => {
  it("renders when open and shows a failure notice on denied retry", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { isSuccess: false } });
    renderWithProviders(
      <RepositoryAccessModal
        isOpen
        onOpenChange={vi.fn()}
        onAuthorized={vi.fn()}
        refetchAuthorization={refetch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/Authorization still denied/i),
      ).toBeInTheDocument(),
    );
  });

  it("calls onAuthorized when the retry succeeds", async () => {
    const onAuthorized = vi.fn();
    const refetch = vi.fn().mockResolvedValue({ data: { isSuccess: true } });
    renderWithProviders(
      <RepositoryAccessModal
        isOpen
        onOpenChange={vi.fn()}
        onAuthorized={onAuthorized}
        refetchAuthorization={refetch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => expect(onAuthorized).toHaveBeenCalled());
  });

  it("opens the Blocks OS repositories page from Manage repositories", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithProviders(
      <RepositoryAccessModal
        isOpen
        onOpenChange={vi.fn()}
        onAuthorized={vi.fn()}
        refetchAuthorization={vi.fn().mockResolvedValue({ data: {} })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Manage repositories/i }),
    );
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
