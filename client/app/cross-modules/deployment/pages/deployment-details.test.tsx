import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";

const navigateMock = vi.fn();
let params: Record<string, string | undefined> = { repoId: "r1", buildId: "b1" };

vi.mock("@/cross-modules/deployment/hooks/use-github-info", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/cross-modules/deployment/hooks/use-github-info")
    >();
  return { ...actual, useGetCardProjectAndBranch: vi.fn() };
});
vi.mock("@/cross-modules/deployment/hooks/use-observability", () => ({
  useGetSCALibraryData: () => ({ data: undefined, isLoading: false, error: null }),
  useSCARedirectLink: () => ({ isLoading: false, refetch: vi.fn() }),
  useGetSASTData: () => ({ data: undefined, isLoading: false, error: null }),
  useSASTRedirectLink: () => ({ isLoading: false, refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useParams: () => params,
    useNavigate: () => navigateMock,
  };
});

import DeploymentDetails from "./deployment-details";

describe("DeploymentDetails page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = { repoId: "r1", buildId: "b1" };
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: { data: { events: [], status: "Completed" }, isSuccess: true },
      isSuccess: true,
      isError: false,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as never);
  });

  it("renders the build id heading and tab navigation", () => {
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    expect(screen.getByRole("heading", { name: "b1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SCA" })).toBeInTheDocument();
  });

  it("switches to the SCA tab", () => {
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    fireEvent.click(screen.getByRole("button", { name: "SCA" }));
    expect(screen.getByRole("button", { name: "SCA" })).toBeInTheDocument();
  });

  it("navigates back when the back button is clicked", () => {
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    // The first ghost button is the back control.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("shows the loading state when there is no build id", () => {
    params = { repoId: "r1", buildId: undefined };
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1",
    });
    expect(
      screen.getByText("Loading deployment details..."),
    ).toBeInTheDocument();
  });

  it("redirects and toasts on a fatal fetch error", async () => {
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: undefined,
      isSuccess: false,
      isError: true,
      error: { errors: { data: null, isSuccess: false } },
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<DeploymentDetails />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    const { toast } = await import("@/hooks/use-toast");
    expect(navigateMock).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });
});
