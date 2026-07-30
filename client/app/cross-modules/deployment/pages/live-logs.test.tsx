import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetCardProjectAndBranch } from "@/cross-modules/deployment/hooks/use-github-info";

const navigateMock = vi.fn();
let params: Record<string, string | undefined> = { repoId: "r1", buildId: "b1" };

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGetCardProjectAndBranch: vi.fn(),
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

import LiveLogs from "./live-logs";

describe("LiveLogs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = { repoId: "r1", buildId: "b1" };
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: { data: { events: [] } },
      isSuccess: true,
      isError: false,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as never);
  });

  it("renders the build id and navigates back with a refresh", () => {
    renderWithProviders(<LiveLogs />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    expect(screen.getByRole("heading", { name: "b1" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("refresh=true"),
    );
  });

  it("redirects and toasts on a fatal error", async () => {
    vi.mocked(useGetCardProjectAndBranch).mockReturnValue({
      data: undefined,
      isSuccess: false,
      isError: true,
      error: { errors: { data: null, isSuccess: false } },
      isLoading: false,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<LiveLogs />, {
      route: "/app/deployment/repo/r1/deployment-live/b1",
    });
    const { toast } = await import("@/hooks/use-toast");
    expect(navigateMock).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });
});
