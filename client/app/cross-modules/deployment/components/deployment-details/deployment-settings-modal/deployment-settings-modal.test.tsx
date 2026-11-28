import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetRepoDetails,
  useGetSpecs,
  useUpdateRepoSettings,
} from "@/cross-modules/deployment/hooks/use-github-info";

const navigateMock = vi.fn();
let updateOptions: {
  onSuccess?: (response?: unknown) => void;
  onError?: (error?: unknown) => void;
} = {};
const updateMutate = vi.fn();

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGetRepoDetails: vi.fn(),
  useGetSpecs: vi.fn(),
  useUpdateRepoSettings: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

import DeploymentSettingsModal from "./deployment-settings-modal";

const specs = {
  data: [
    {
      id: "azure-1",
      name: "Azure",
      region: [
        {
          id: "we-1",
          name: "West Europe",
          machineSpecs: [{ id: "spec-1", status: "active" }],
        },
      ],
    },
  ],
};

const repoDetails = {
  data: {
    repo: {
      itemId: "r1",
      deploymentType: "Auto",
      deploySettings: {},
    },
  },
};

describe("DeploymentSettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOptions = {};
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: repoDetails,
      isError: false,
      error: null,
    } as never);
    vi.mocked(useGetSpecs).mockReturnValue({
      data: specs,
      isLoading: false,
    } as never);
    vi.mocked(useUpdateRepoSettings).mockImplementation((opts: never) => {
      updateOptions = opts as never;
      return { mutate: updateMutate, isPending: false } as never;
    });
  });

  it("invokes onDeploy in the deployment flow", () => {
    const onDeploy = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal
        isOpen
        onClose={vi.fn()}
        repoId="r1"
        isDeploymentFlow
        onDeploy={onDeploy}
      />,
    );
    expect(screen.getByText("Configure Deployment")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(onDeploy).toHaveBeenCalled();
  });

  it("opts the first deployment into Blocks Monitor by default", () => {
    const onDeploy = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal
        isOpen
        onClose={vi.fn()}
        repoId="r1"
        isDeploymentFlow
        onDeploy={onDeploy}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "View in Blocks Monitor" }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(onDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ viewInBlocksMonitor: true }),
    );
  });

  it("lets the user opt the first deployment out of Blocks Monitor", () => {
    const onDeploy = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal
        isOpen
        onClose={vi.fn()}
        repoId="r1"
        isDeploymentFlow
        onDeploy={onDeploy}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "View in Blocks Monitor" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Deploy Now" }));
    expect(onDeploy).toHaveBeenCalledWith(
      expect.objectContaining({ viewInBlocksMonitor: false }),
    );
  });

  it("does not offer Blocks Monitor when editing settings", () => {
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    expect(
      screen.queryByRole("checkbox", { name: "View in Blocks Monitor" }),
    ).not.toBeInTheDocument();
  });

  it("saves settings and shows a success toast", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={onClose} repoId="r1" />,
    );
    expect(screen.getByText("Deployment Settings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: "r1" }),
    );
    const { toast } = await import("@/hooks/use-toast");
    updateOptions.onSuccess?.();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error toast when the update fails", async () => {
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    const { toast } = await import("@/hooks/use-toast");
    updateOptions.onError?.();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  // ─── #279: GitHub webhook refusals and warnings ─────────────────────────────

  const withManualRepo = () =>
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: {
        data: {
          repo: {
            ...repoDetails.data.repo,
            repoName: "e2e/webhook-repo",
            deploymentType: "Manual",
          },
        },
      },
      isError: false,
      error: null,
    } as never);

  // S1, C1, C3, C18: a refused switch to Git based keeps the modal open with the user's choice.
  it("shows the refusal's text and keeps the modal open with Git based selected", async () => {
    withManualRepo();
    const onClose = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={onClose} repoId="r1" />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Git based deployment" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ deploymentType: "auto" }),
    );

    const { toast } = await import("@/hooks/use-toast");
    act(() => updateOptions.onError?.({ errors: { webhook: "GITHUB_NOT_CONNECTED" } }));

    expect(toast).toHaveBeenCalledWith({
      title: "Settings",
      description: "Connect your GitHub account to use Git based deployment.",
      variant: "destructive",
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("radio", { name: "Git based deployment" }),
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Save Settings" })).toBeEnabled();
  });

  it("names the repository in a permission refusal", async () => {
    withManualRepo();
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    const { toast } = await import("@/hooks/use-toast");
    updateOptions.onError?.({ errors: { webhook: "GITHUB_WEBHOOK_PERMISSION" } });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "Your GitHub account can't manage webhooks on e2e/webhook-repo. Git based deployment needs a repository admin, or a role with the Manage webhooks permission.",
      }),
    );
  });

  // C15 UI path: any other failure keeps today's text.
  it("keeps today's failure text for a failure without a webhook code", async () => {
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    const { toast } = await import("@/hooks/use-toast");
    updateOptions.onError?.({ errors: { message: "Failed to update." } });
    expect(toast).toHaveBeenCalledWith({
      title: "Settings",
      description: "Failed to update settings",
      variant: "destructive",
    });
  });

  // S2, C8, H13: saved with a warning shows the success toast, then the warning, and closes.
  it("shows the warning after the success toast and closes", async () => {
    withManualRepo();
    const onClose = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={onClose} repoId="r1" />,
    );
    const { toast } = await import("@/hooks/use-toast");
    updateOptions.onSuccess?.({
      isSuccess: true,
      warning: {
        code: "WEBHOOK_NOT_WORKING",
        reason: "GITHUB_UNREACHABLE",
        message: "server text",
        detail: null,
      },
    });

    expect(vi.mocked(toast).mock.calls.map(([options]) => options)).toEqual([
      expect.objectContaining({ variant: "success" }),
      {
        title: "Git based deployment",
        description:
          "Settings saved, but Git based deployment isn't working: GitHub didn't respond. Try again in a moment.",
        variant: "warning",
      },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows no warning toast when the save has none", async () => {
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    const { toast } = await import("@/hooks/use-toast");
    updateOptions.onSuccess?.({ isSuccess: true });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("closes and resets on cancel", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={onClose} repoId="r1" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("redirects away when the repo cannot be resolved", () => {
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: undefined,
      isError: true,
      error: { errors: { data: { repo: null }, isSuccess: false } },
    } as never);
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    expect(navigateMock).toHaveBeenCalled();
  });

  // ─── Custom domain only ─────────────────────────────────────────────────────

  const withRepo = (repo: Record<string, unknown>) =>
    vi.mocked(useGetRepoDetails).mockReturnValue({
      data: { data: { repo: { ...repoDetails.data.repo, ...repo } } },
      isError: false,
      error: null,
    } as never);

  it("does not offer the domain choice while the repository has no custom domain", () => {
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    expect(
      screen.queryByRole("radiogroup", { name: "Domains" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ isCustomDomainOnly: undefined }),
    );
  });

  it("does not offer the domain choice in the first-deployment flow", () => {
    withRepo({ customDeploymentUrl: "app.example.com" });
    renderWithProviders(
      <DeploymentSettingsModal
        isOpen
        onClose={vi.fn()}
        repoId="r1"
        isDeploymentFlow
        onDeploy={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("radiogroup", { name: "Domains" }),
    ).not.toBeInTheDocument();
  });

  it("deploys to both domains by default and saves that choice", () => {
    withRepo({ customDeploymentUrl: "app.example.com" });
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    expect(
      screen.getByRole("radio", { name: "Default and custom domain" }),
    ).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: "r1", isCustomDomainOnly: false }),
    );
  });

  it("saves custom domain only when the user picks it", () => {
    withRepo({ customDeploymentUrl: "app.example.com" });
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Custom domain only" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ isCustomDomainOnly: true }),
    );
  });

  it("prefills the stored choice and lets the user switch back to both domains", () => {
    withRepo({ customDeploymentUrl: "app.example.com", isCustomDomainOnly: true });
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );
    expect(screen.getByRole("radio", { name: "Custom domain only" })).toBeChecked();

    fireEvent.click(
      screen.getByRole("radio", { name: "Default and custom domain" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ isCustomDomainOnly: false }),
    );
  });

  // ─── Pagination (#175) ──────────────────────────────────────────────────────

  // This modal is mounted even while closed and always calls useGetRepoDetails, so once
  // the query key carries paging it would issue a SECOND request alongside the page's.
  // Forwarding the caller's paging keeps both on one cache entry. The modal reads only
  // data.repo, so which page it asks for is immaterial to it.
  it("forwards the paging it was given so it shares the caller's query", () => {
    renderWithProviders(
      <DeploymentSettingsModal
        isOpen
        onClose={vi.fn()}
        repoId="r1"
        pageNumber={1}
        pageSize={1}
      />,
    );

    expect(useGetRepoDetails).toHaveBeenCalledWith("r1", {
      pageNumber: 1,
      pageSize: 1,
    });
  });

  it("falls back to the endpoint's own defaults when given no paging", () => {
    renderWithProviders(
      <DeploymentSettingsModal isOpen onClose={vi.fn()} repoId="r1" />,
    );

    expect(useGetRepoDetails).toHaveBeenCalledWith("r1", {
      pageNumber: 1,
      pageSize: 30,
    });
  });
});
