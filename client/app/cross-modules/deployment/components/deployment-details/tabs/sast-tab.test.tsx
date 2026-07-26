import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetSASTData,
  useSASTRedirectLink,
} from "@/cross-modules/deployment/hooks/use-observability";

vi.mock("@/cross-modules/deployment/hooks/use-observability", () => ({
  useGetSASTData: vi.fn(),
  useSASTRedirectLink: vi.fn(),
  useGetSCALibraryData: vi.fn(),
  useSCARedirectLink: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => ({ buildId: "b1" }) };
});

import SastTab from "./sast-tab";

describe("SastTab", () => {
  beforeEach(() => {
    vi.mocked(useSASTRedirectLink).mockReturnValue({
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as never);
  });

  it("renders the loading skeleton", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    const { container } = renderWithProviders(<SastTab />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the empty state when there are no details", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {},
      isLoading: false,
      error: null,
    } as never);
    const { container } = renderWithProviders(<SastTab />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the overview when details are present", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: {
            alert_status: "OK",
            ncloc: "1200",
            software_quality_security_issues: "3",
            software_quality_security_rating: "1.0",
            coverage: "80",
            lines_to_cover: "500",
            duplicated_lines_density: "2",
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Quality Gate")).toBeInTheDocument();
  });

  it("redirects to SonarQube when the button is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const refetch = vi.fn().mockResolvedValue({});
    vi.mocked(useSASTRedirectLink).mockReturnValue({
      isLoading: false,
      refetch,
    } as never);
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: {
            alert_status: "ERROR",
            software_quality_security_rating: "3.0",
            software_quality_reliability_rating: "4.0",
            sqale_rating: "2.0",
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    vi.useFakeTimers();
    renderWithProviders(<SastTab />);
    fireEvent.click(screen.getByRole("button", { name: /View in SonarQube/i }));
    expect(refetch).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(openSpy).toHaveBeenCalled();
    vi.useRealTimers();
    openSpy.mockRestore();
  });

  it("renders an error state", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "failed" },
    } as never);
    const { container } = renderWithProviders(<SastTab />);
    expect(container.firstChild).toBeTruthy();
  });
});
