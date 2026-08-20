import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetRepoDetails,
  useGetSpecs,
  useUpdateRepoSettings,
} from "@/cross-modules/deployment/hooks/use-github-info";

const navigateMock = vi.fn();
let updateOptions: { onSuccess?: () => void; onError?: () => void } = {};
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
