import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { formatFullDate } from "@/utils/date.util";
import {
  useGetSCALibraryData,
  useSCARedirectLink,
} from "@/cross-modules/deployment/hooks/use-observability";

vi.mock("@/cross-modules/deployment/hooks/use-observability", () => ({
  useGetSCALibraryData: vi.fn(),
  useSCARedirectLink: vi.fn(),
  useGetSASTData: vi.fn(),
  useSASTRedirectLink: vi.fn(),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: () => ({ buildId: "b1" }) };
});

import SCATab from "./sca-tab";

const redirectStub = {
  isLoading: false,
  refetch: vi.fn().mockResolvedValue({ data: {} }),
} as never;

describe("SCATab", () => {
  beforeEach(() => {
    vi.mocked(useSCARedirectLink).mockReturnValue(redirectStub);
  });

  it("renders the loading skeleton", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    const { container } = renderWithProviders(<SCATab />);
    expect(container.querySelector(".animate-pulse, .overflow-hidden")).toBeTruthy();
  });

  it("renders an error card on failure", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "boom" },
    } as never);
    renderWithProviders(<SCATab />);
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("renders the empty dependency table when loaded with no vulnerabilities", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: {
        data: {
          details: {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
            unassigned: 0,
            inheritedRiskScore: 5,
            vulnerabilities: "6",
            vulnerableComponents: "2",
            components: "10",
          },
          vulnerabilities: [],
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SCATab />);
    expect(screen.getByText("Software library package")).toBeInTheDocument();
    expect(screen.getByText("No dependencies found.")).toBeInTheDocument();
  });

  it("renders a dependency row when vulnerabilities exist", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: {
        data: {
          details: {
            critical: 1,
            high: 0,
            medium: 0,
            low: 0,
            unassigned: 0,
            inheritedRiskScore: 9,
          },
          vulnerabilities: [
            {
              name: "left-pad",
              group: "npm",
              version: "1.0.0",
              id: "CVE-1",
              score: "9.8",
              severity: "CRITICAL",
              epssPercentile: 0.5,
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SCATab />);
    expect(screen.getByText("left-pad")).toBeInTheDocument();
    expect(screen.getByText("CVE-1")).toBeInTheDocument();
  });

  const manyVulns = Array.from({ length: 7 }).map((_, i) => ({
    name: `pkg-${i}`,
    group: "npm",
    version: "1.0.0",
    id: `CVE-${i}`,
    score: "9.8",
    severity: i === 0 ? "CRITICAL" : "HIGH",
    epssPercentile: 0.5,
  }));

  it("filters by severity card and paginates the dependency table", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: {
        data: {
          details: { critical: 1, high: 6, medium: 0, low: 0, unassigned: 0 },
          vulnerabilities: manyVulns,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SCATab />);
    // Pagination controls are present for more than one page.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // Clicking the Critical summary card filters to critical rows only.
    fireEvent.click(screen.getByRole("button", { name: /^Critical/ }));
    expect(screen.getByText("pkg-0")).toBeInTheDocument();
  });

  it("filters the dependency table from every severity card", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: {
        data: {
          details: { critical: 1, high: 6, medium: 0, low: 0, unassigned: 0 },
          vulnerabilities: manyVulns,
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SCATab />);

    // High keeps only the high rows and drops the critical one.
    fireEvent.click(screen.getByRole("button", { name: /^High/ }));
    expect(screen.getByText("pkg-1")).toBeInTheDocument();
    expect(screen.queryByText("pkg-0")).not.toBeInTheDocument();

    // The remaining cards have no matching rows.
    [/^Medium/, /^Low/, /^Unassigned/].forEach((name) => {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByText("No dependencies found.")).toBeInTheDocument();
    });
  });

  const renderLibraries = (refetch: ReturnType<typeof vi.fn>, isLoading = false) => {
    vi.mocked(useSCARedirectLink).mockReturnValue({ isLoading, refetch } as never);
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: {
        data: {
          details: { critical: 0, high: 0, medium: 0, low: 0, unassigned: 0 },
          vulnerabilities: [],
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SCATab />);
  };

  const stubTab = () => {
    const tab = { opener: {}, location: { href: "about:blank" } } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(tab);
    return { tab, openSpy };
  };

  it("opens the build's project in Dependency Track", async () => {
    const { tab, openSpy } = stubTab();
    const refetch = vi.fn().mockResolvedValue({
      isError: false,
      data: { isSuccess: true, data: { projectUuid: "5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c" } },
    });
    renderLibraries(refetch);

    fireEvent.click(screen.getByRole("button", { name: /Dependency Track/i }));

    expect(openSpy).toHaveBeenCalledWith("about:blank", "_blank");
    await vi.waitFor(() =>
      expect(tab.location.href).toBe(
        "https://sca.seliseblocks.com/projects/5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c",
      ),
    );
    expect(refetch).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("silently opens the Dependency Track home page when no project is found", async () => {
    const { tab, openSpy } = stubTab();
    renderLibraries(
      vi.fn().mockResolvedValue({ isError: false, data: { data: { projectUuid: null } } }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Dependency Track/i }));

    await vi.waitFor(() => expect(tab.location.href).toBe("https://sca.seliseblocks.com"));
    openSpy.mockRestore();
  });

  it("silently opens the Dependency Track home page when the access call fails", async () => {
    const { tab, openSpy } = stubTab();
    renderLibraries(vi.fn().mockResolvedValue({ isError: true, data: undefined }));

    fireEvent.click(screen.getByRole("button", { name: /Dependency Track/i }));

    await vi.waitFor(() => expect(tab.location.href).toBe("https://sca.seliseblocks.com"));
    openSpy.mockRestore();
  });

  it("disables the Dependency Track button while the access call is loading", () => {
    renderLibraries(vi.fn(), true);
    expect(screen.getByRole("button", { name: /Dependency Track/i })).toBeDisabled();
  });

  it("opens the vulnerability details dialog and filters dependencies", () => {
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: {
        data: {
          details: { critical: 1, high: 0, medium: 0, low: 0, unassigned: 0 },
          vulnerabilities: [
            {
              name: "left-pad",
              group: "npm",
              version: "1.0.0",
              id: "CVE-1",
              score: "9.8",
              severity: "CRITICAL",
              epssPercentile: 0.5,
            },
          ],
        },
      },
      isLoading: false,
      error: null,
    } as never);
    renderWithProviders(<SCATab />);
    // Open the details dialog by clicking the dependency row.
    fireEvent.click(screen.getByText("left-pad"));
    expect(screen.getByText("Vulnerability details")).toBeInTheDocument();
    // Filter the dependency table.
    const search = screen.getByPlaceholderText("Search dependencies...");
    fireEvent.change(search, { target: { value: "nomatch" } });
    expect(search).toHaveValue("nomatch");
  });
});

describe("SCATab saved report (#255)", () => {
  const analyzedAt = "2026-10-28T20:58:00Z";
  const capturedAt = "2026-10-28T21:10:00Z";
  const details = {
    critical: 1,
    high: 1,
    medium: 0,
    low: 0,
    unassigned: 0,
    inheritedRiskScore: 15,
    vulnerabilities: "2",
    vulnerableComponents: "2",
    components: "40",
    kev: "0",
  };
  const vulnerabilities = [
    {
      name: "left-pad",
      group: "npm",
      version: "1.0.0",
      id: "CVE-1",
      score: "9.8",
      severity: "CRITICAL",
    },
    { name: "lodash", group: "npm", version: "4.0.0", id: "CVE-2", score: "7.5", severity: "HIGH" },
  ];

  const mockReport = (data: Record<string, unknown> | undefined, error: unknown = null) =>
    vi.mocked(useGetSCALibraryData).mockReturnValue({
      data: data === undefined ? undefined : { data },
      isLoading: false,
      error,
    } as never);

  let redirect: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    redirect = vi.fn().mockResolvedValue({
      isError: false,
      data: { isSuccess: true, data: { projectUuid: "5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c" } },
    });
    vi.mocked(useSCARedirectLink).mockReturnValue({ isLoading: false, refetch: redirect } as never);
  });

  it("H9 — a legacy report without status renders today's results with no caption", () => {
    mockReport({ details, vulnerabilities });
    renderWithProviders(<SCATab />);
    expect(screen.getByText("Software library package")).toBeInTheDocument();
    expect(screen.getByText("left-pad")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Dependency Track/i })).toHaveLength(1);
    expect(screen.queryByText(/^Analyzed /)).not.toBeInTheDocument();
    expect(screen.queryByText(/most severe findings/)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("H9 — a legacy report without details keeps today's error display", () => {
    mockReport({ details: null, vulnerabilities: null });
    renderWithProviders(<SCATab />);
    expect(screen.getByText("Error loading SCA data")).toBeInTheDocument();
  });

  it("H10 — Pending shows the SCA Data Processing card announced as a status", () => {
    mockReport({ type: "Sca", status: "Pending", details: null, vulnerabilities: null });
    renderWithProviders(<SCATab />);
    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("Software Composition Analysis");
    expect(card).toHaveTextContent("Data Processing");
    expect(card).toHaveTextContent("Analysis in progress");
    expect(screen.queryByText("Error loading SCA data")).not.toBeInTheDocument();
  });

  it("H11 — Pending then Ready swaps to the results with the Analyzed caption", () => {
    mockReport({ type: "Sca", status: "Pending", details: null });
    const { rerender } = renderWithProviders(<SCATab />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    mockReport({
      type: "Sca",
      status: "Ready",
      capturedAt,
      analyzedAt,
      findingsTruncated: false,
      details,
      vulnerabilities,
    });
    rerender(<SCATab />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("left-pad")).toBeInTheDocument();
    const caption = screen.getByText(`Analyzed ${formatFullDate(new Date(analyzedAt))}`);
    expect(caption).toHaveClass("text-xs", "text-medium-emphasis");
    expect(screen.queryByText(/most severe findings/)).not.toBeInTheDocument();
  });

  it("H11 — Ready without analyzedAt falls back to capturedAt", () => {
    mockReport({
      type: "Sca",
      status: "Ready",
      capturedAt,
      findingsTruncated: false,
      details,
      vulnerabilities: [],
    });
    renderWithProviders(<SCATab />);
    expect(
      screen.getByText(`Analyzed ${formatFullDate(new Date(capturedAt))}`),
    ).toBeInTheDocument();
  });

  it("C12 — truncated findings show the count line with the Dependency-Track button", async () => {
    const tab = { opener: {}, location: { href: "about:blank" } } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(tab);
    mockReport({
      type: "Sca",
      status: "Ready",
      capturedAt,
      analyzedAt,
      findingsTruncated: true,
      details,
      vulnerabilities,
    });
    renderWithProviders(<SCATab />);

    const line = screen.getByText(
      "Showing the 2 most severe findings. Open Dependency-Track for the full list.",
    );
    expect(line).toHaveClass("text-xs", "text-medium-emphasis");
    const buttons = screen.getAllByRole("button", { name: /Dependency Track/i });
    expect(buttons).toHaveLength(2);
    expect(line.parentElement).toContainElement(buttons[1]);

    fireEvent.click(buttons[1]);
    expect(redirect).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(tab.location.href).toBe(
        "https://sca.seliseblocks.com/projects/5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c",
      ),
    );
    openSpy.mockRestore();
  });

  it("C14 — NotRun shows Scan did not run with the message, an amber icon and the Dependency-Track button", () => {
    mockReport({ type: "Sca", status: "NotRun", message: "The sca-scan step did not run." });
    renderWithProviders(<SCATab />);
    expect(screen.getByText("Software Composition Analysis")).toBeInTheDocument();
    expect(screen.getByText("Scan did not run")).toBeInTheDocument();
    expect(screen.getByText("The sca-scan step did not run.")).toBeInTheDocument();
    expect(screen.getByTestId("report-unavailable-icon")).toHaveClass("text-amber-600");
    expect(screen.getByRole("button", { name: /Dependency Track/i })).toBeEnabled();
    expect(screen.queryByText("Software library package")).not.toBeInTheDocument();
  });

  it("C14 — Failed shows Results not captured with the message, a red icon and the Dependency-Track button", async () => {
    const tab = { opener: {}, location: { href: "about:blank" } } as unknown as Window;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(tab);
    mockReport({ type: "Sca", status: "Failed", message: "Results were not captured." });
    renderWithProviders(<SCATab />);
    expect(screen.getByText("Results not captured")).toBeInTheDocument();
    expect(screen.getByText("Results were not captured.")).toBeInTheDocument();
    expect(screen.getByTestId("report-unavailable-icon")).toHaveClass("text-red-600");

    fireEvent.click(screen.getByRole("button", { name: /Dependency Track/i }));
    expect(redirect).toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(tab.location.href).toBe(
        "https://sca.seliseblocks.com/projects/5f1c2a9e-0b7d-4e44-9b1e-2d3c4f5a6b7c",
      ),
    );
    openSpy.mockRestore();
  });

  it("a request error keeps today's ErrorDisplay", () => {
    mockReport(undefined, { message: "boom" });
    renderWithProviders(<SCATab />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.queryByText("Scan did not run")).not.toBeInTheDocument();
  });
});
