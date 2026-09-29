import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: () => ({ buildId: "b1" }) };
});

import SastTab from "./sast-tab";


const exampleGate = {
  status: "ERROR" as const,
  conditions: [
    {
      metricKey: "new_violations",
      comparator: "GT" as const,
      errorThreshold: "0",
      actualValue: "69",
      status: "ERROR" as const,
    },
    {
      metricKey: "new_security_hotspots_reviewed",
      comparator: "LT" as const,
      errorThreshold: "100",
      actualValue: "0.0",
      status: "ERROR" as const,
    },
    {
      metricKey: "new_coverage",
      comparator: "LT" as const,
      errorThreshold: "5.0",
      actualValue: "0.0",
      status: "ERROR" as const,
    },
    {
      metricKey: "new_duplicated_lines_density",
      comparator: "GT" as const,
      errorThreshold: "25.0",
      actualValue: "1.44",
      status: "OK" as const,
    },
  ],
};

const exampleBreakdown = {
  newCode: { total: 69, blocker: 0, high: 3, medium: 40, low: 20, info: 6 },
  overall: { total: 112, blocker: 1, high: 13, medium: 60, low: 30, info: 8 },
};

const exampleDetails = {
  alert_status: "OK",
  ncloc: "1200",
  // New Code (Example 1)
  new_violations: "69",
  new_coverage: "0.0",
  new_lines_to_cover: "780",
  new_duplicated_lines_density: "1.44",
  new_lines: "5512",
  new_security_hotspots: "1",
  new_security_review_rating: "5.0",
  new_code_period_date: "2026-08-10T09:12:00+0000",
  new_code_period_mode: "previous_version",
  // Overall Code (Example 2)
  software_quality_security_issues: "0",
  software_quality_security_rating: "1.0",
  software_quality_reliability_issues: "13",
  software_quality_reliability_rating: "3.0",
  software_quality_maintainability_issues: "99",
  software_quality_maintainability_rating: "1.0",
  security_hotspots: "5",
  security_review_rating: "5.0",
  lines: "9021",
  duplicated_lines_density: "1.2",
  software_quality_maintainability_remediation_effort: "2940",
  coverage: "80",
  lines_to_cover: "500",
};

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

  it("renders the Data Processing card when details are null", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: { data: { details: null } },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Data Processing")).toBeInTheDocument();
    expect(
      screen.getByText("Static Application Security Testing"),
    ).toBeInTheDocument();
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

  it("renders New Code by default and Overall Code on click (Examples 1+2)", async () => {
    const user = userEvent.setup();
    vi.mocked(useGetSASTData).mockReturnValue({
      data: { data: { details: exampleDetails } },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Quality Gate")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "New Code" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByText(/New code: Since August 10, 2026/)).toBeInTheDocument();
    expect(screen.getByTestId("sast-stat-new-issues")).toHaveTextContent("69");

    await user.click(screen.getByRole("tab", { name: "Overall Code" }));
    expect(screen.getByRole("tab", { name: "Overall Code" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByTestId("sast-stat-overall-reliability")).toHaveTextContent(
      "13",
    );
    expect(screen.getByTestId("sast-rating-overall-reliability")).toHaveTextContent(
      "C",
    );
  });

  it("shows No new lines to analyze when new_lines is 0", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: {
            ...exampleDetails,
            new_lines: "0",
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("No new lines to analyze")).toBeInTheDocument();
  });

  it("labels Quality Gate Not computed when alert_status is missing", () => {
    const { alert_status: _, ...rest } = exampleDetails;
    vi.mocked(useGetSASTData).mockReturnValue({
      data: { data: { details: rest } },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Not computed")).toBeInTheDocument();
  });

  const renderOverview = (refetch: ReturnType<typeof vi.fn>, isLoading = false) => {
    vi.mocked(useSASTRedirectLink).mockReturnValue({ isLoading, refetch } as never);
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: exampleDetails,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
  };

  const stubTab = () => {
    const tab = { opener: {}, location: { href: "about:blank" } } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(tab);
    return { tab, openSpy };
  };

  it("opens the build's project and branch dashboard in SonarQube", async () => {
    const { tab, openSpy } = stubTab();
    const refetch = vi.fn().mockResolvedValue({
      isError: false,
      data: { isSuccess: true, data: { projectKey: "org-repo", branch: "feature/x" } },
    });
    renderOverview(refetch);

    fireEvent.click(screen.getByRole("button", { name: /View in SonarQube/i }));

    expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
    expect(refetch).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(tab.location.href).toBe(
        "https://code.selise.biz/dashboard?id=org-repo&branch=feature%2Fx",
      ),
    );
    openSpy.mockRestore();
  });

  it("silently opens the SonarQube home page when the access call fails", async () => {
    const { tab, openSpy } = stubTab();
    renderOverview(vi.fn().mockResolvedValue({ isError: true, data: undefined }));

    fireEvent.click(screen.getByRole("button", { name: /View in SonarQube/i }));

    await vi.waitFor(() => expect(tab.location.href).toBe("https://code.selise.biz"));
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it("disables the SonarQube button while the access call is loading", () => {
    renderOverview(vi.fn(), true);
    expect(screen.getByRole("button", { name: /View in SonarQube/i })).toBeDisabled();
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

describe("SastTab Phase 2", () => {
  beforeEach(() => {
    vi.mocked(useSASTRedirectLink).mockReturnValue({
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as never);
  });

  it("Example 1 — failed conditions and Failed badges (H3, H4, H6)", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: { ...exampleDetails, alert_status: "ERROR" },
          qualityGate: exampleGate,
          issueBreakdown: exampleBreakdown,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3 conditions failed")).toBeInTheDocument();
    expect(screen.getByText(/is greater than 0/)).toBeInTheDocument();
    expect(screen.getByTestId("sast-failed-new-issues")).toBeInTheDocument();
    expect(screen.getByTestId("sast-failed-new-coverage")).toBeInTheDocument();
    expect(screen.getByTestId("sast-failed-new-hotspots")).toBeInTheDocument();
    expect(screen.queryByTestId("sast-failed-new-duplications")).not.toBeInTheDocument();
    expect(screen.getByText("Required = 0")).toBeInTheDocument();
  });

  it("Example 2 — severity rows on both tabs (H5)", async () => {
    const user = userEvent.setup();
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: exampleDetails,
          qualityGate: { status: "OK", conditions: exampleGate.conditions.map((c) => ({ ...c, status: "OK" as const })) },
          issueBreakdown: exampleBreakdown,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Issues by severity")).toBeInTheDocument();
    expect(screen.getByText("High 3")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Overall Code" }));
    expect(screen.getByText("High 13")).toBeInTheDocument();
    expect(screen.getByText("Blocker 1")).toBeInTheDocument();
  });

  it("Example 3 — All conditions passed (H6)", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: exampleDetails,
          qualityGate: {
            status: "OK",
            conditions: exampleGate.conditions.map((c) => ({ ...c, status: "OK" as const })),
          },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("All conditions passed")).toBeInTheDocument();
    expect(screen.queryByTestId("sast-failed-new-issues")).not.toBeInTheDocument();
  });

  it("Example 4 — gate null keeps metrics (C1)", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: { ...exampleDetails, alert_status: "ERROR" },
          qualityGate: null,
          issueBreakdown: exampleBreakdown,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText(/conditions failed/)).not.toBeInTheDocument();
    expect(screen.getByTestId("sast-stat-new-issues")).toHaveTextContent("69");
    expect(screen.getByText("High 3")).toBeInTheDocument();
  });

  it("Example 5 — newCode severity null hides only New Code row (C2)", async () => {
    const user = userEvent.setup();
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: exampleDetails,
          qualityGate: null,
          issueBreakdown: { newCode: null, overall: exampleBreakdown.overall },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.queryByText("High 3")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Overall Code" }));
    expect(screen.getByText("High 13")).toBeInTheDocument();
  });

  it("Example 6 — NONE status Not computed (C5)", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: exampleDetails,
          qualityGate: { status: "NONE", conditions: [] },
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Not computed")).toBeInTheDocument();
    expect(screen.queryByText(/conditions failed/)).not.toBeInTheDocument();
    expect(screen.queryByText("All conditions passed")).not.toBeInTheDocument();
  });

  it("Example 8 — measures null shows Data Processing even if gate present (C3)", () => {
    vi.mocked(useGetSASTData).mockReturnValue({
      data: {
        data: {
          details: null,
          qualityGate: exampleGate,
          issueBreakdown: exampleBreakdown,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SastTab />);
    expect(screen.getByText("Data Processing")).toBeInTheDocument();
  });
});

