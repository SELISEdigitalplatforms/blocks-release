import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
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

  describe("report edge cases", () => {
    type Vuln = Record<string, unknown>;

    const renderReport = (vulnerabilities: Vuln[]) => {
      vi.mocked(useGetSCALibraryData).mockReturnValue({
        data: {
          data: {
            details: {
              critical: 1,
              high: 2,
              medium: 3,
              low: 4,
              unassigned: 5,
              inheritedRiskScore: 7,
              vulnerabilities: "15",
              vulnerableComponents: "4",
              components: "40",
            },
            vulnerabilities,
          },
        },
        isLoading: false,
        error: null,
      } as never);
      return renderWithProviders(<SCATab />);
    };

    const vulns = (count: number, severity = "HIGH"): Vuln[] =>
      Array.from({ length: count }).map((_, i) => ({
        name: `pkg-${i}`,
        group: "npm",
        version: "1.0.0",
        id: `CVE-${i}`,
        score: "5.0",
        severity,
        epssPercentile: 0.1,
      }));

    const bodyRowNames = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("button")[0].textContent);

    const summaryText = (from: number, to: number, total: number) =>
      new RegExp(`Showing ${from}-\\s*${to} of\\s*${total} entries`);

    it("shows the default error when the report has no data and no error", () => {
      vi.mocked(useGetSCALibraryData).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);
      renderWithProviders(<SCATab />);
      expect(screen.getByText("Error loading SCA data")).toBeInTheDocument();
      expect(
        screen.queryByText("Software library package"),
      ).not.toBeInTheDocument();
    });

    it("shows the default error when the report has no details", () => {
      vi.mocked(useGetSCALibraryData).mockReturnValue({
        data: { data: { vulnerabilities: vulns(1) } },
        isLoading: false,
        error: null,
      } as never);
      renderWithProviders(<SCATab />);
      expect(screen.getByText("Error loading SCA data")).toBeInTheDocument();
    });

    it("renders the report header metrics", () => {
      renderReport([]);
      expect(screen.getByText("Total components:").nextSibling).toHaveTextContent(
        "40",
      );
      expect(
        screen.getByText("Vulnerable components:").nextSibling,
      ).toHaveTextContent("4");
      expect(screen.getByText("Risk Score:").nextSibling).toHaveTextContent("7");
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("styles each severity badge and maps unknown severities to Unassigned", () => {
      renderReport([
        { ...vulns(1)[0], name: "med", severity: "MEDIUM" },
        { ...vulns(1)[0], name: "low", severity: "LOW" },
        { ...vulns(1)[0], name: "odd", severity: "INFO" },
      ]);
      const table = within(screen.getByRole("table"));
      expect(table.getByText("Medium")).toHaveClass("bg-yellow-100");
      expect(table.getByText("Low")).toHaveClass("bg-green-100");
      expect(table.getByText("Unassigned")).toHaveClass("bg-gray-100");
      // Rows are ordered by severity: Medium, Low, then Unassigned.
      expect(bodyRowNames()).toEqual(["med", "low", "odd"]);
    });

    it("fills in placeholders for a vulnerability with missing fields", () => {
      renderReport([{ severity: "HIGH", epssPercentile: 0 }]);
      const table = within(screen.getByRole("table"));
      // Component, package, version and vulnerability id fall back to Unknown.
      expect(table.getAllByText("Unknown")).toHaveLength(4);
      expect(table.getByText("N/A")).toBeInTheDocument();
      expect(table.getByText("0.00%")).toBeInTheDocument();
      expect(table.getByRole("link", { name: "Unknown" })).toHaveAttribute(
        "href",
        "https://nvd.nist.gov/vuln/detail/Unknown",
      );

      fireEvent.click(table.getAllByText("Unknown")[0]);
      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText("No name available")).toBeInTheDocument();
      expect(dialog.getByText("No version available")).toBeInTheDocument();
      expect(dialog.getByText("No CVSS available.")).toBeInTheDocument();
      expect(dialog.getByText("No EPSS available.")).toBeInTheDocument();
      expect(dialog.getByText("No EPSS Score available.")).toBeInTheDocument();
      expect(dialog.getByText("No description available")).toBeInTheDocument();
      expect(dialog.getByText("NVD")).toBeInTheDocument();
    });

    it("shows every detail of a fully populated vulnerability in the dialog", () => {
      renderReport([
        {
          name: "lodash",
          group: "npm-group",
          version: "4.17.0",
          latestVersion: "4.17.21",
          id: "CVE-2021-23337",
          score: "7.2",
          severity: "HIGH",
          epssPercentile: 0.25,
          epssScore: 0.031,
          cweName: "Command Injection",
          description: "Template injection in lodash",
        },
      ]);
      expect(screen.getByText("25.00%")).toBeInTheDocument();
      fireEvent.click(screen.getByText("npm-group"));
      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText("lodash")).toBeInTheDocument();
      expect(dialog.getByText("4.17.21")).toBeInTheDocument();
      expect(dialog.getByText("7.2")).toBeInTheDocument();
      expect(dialog.getByText("25")).toBeInTheDocument();
      expect(dialog.getByText("0.031")).toBeInTheDocument();
      expect(dialog.getByText("Command Injection")).toBeInTheDocument();
      expect(
        dialog.getByText("Template injection in lodash"),
      ).toBeInTheDocument();
    });

    it("does not open the dialog when the vulnerability link is clicked", () => {
      renderReport(vulns(1));
      fireEvent.click(screen.getByRole("link", { name: "CVE-0" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("orders same-severity rows by CVSS, highest first and unscored last", () => {
      renderReport([
        { name: "high-unscored-a", severity: "HIGH", epssPercentile: 0 },
        { name: "high-5", score: "5.0", severity: "HIGH", epssPercentile: 0 },
        { name: "high-unscored-b", severity: "HIGH", epssPercentile: 0 },
        { name: "high-7.5", score: "7.5", severity: "HIGH", epssPercentile: 0 },
        { name: "critical", severity: "CRITICAL", epssPercentile: 0 },
      ]);
      const names = bodyRowNames();
      expect(names.slice(0, 3)).toEqual(["critical", "high-7.5", "high-5"]);
      expect(names.slice(3).sort()).toEqual([
        "high-unscored-a",
        "high-unscored-b",
      ]);
    });

    it("jumps to page one when a search starts and restores the page when it is cleared", () => {
      renderReport(vulns(7));
      const search = screen.getByPlaceholderText("Search dependencies...");

      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText(summaryText(6, 7, 7))).toBeInTheDocument();

      // Starting a search resets to the first page.
      fireEvent.change(search, { target: { value: "pkg" } });
      expect(screen.getByText(summaryText(1, 5, 7))).toBeInTheDocument();
      expect(screen.getByText("pkg-0")).toBeInTheDocument();

      // Clearing it restores the page the user was on.
      fireEvent.change(search, { target: { value: "" } });
      expect(screen.getByText(summaryText(6, 7, 7))).toBeInTheDocument();
    });

    it("keeps the current page while refining an existing search", () => {
      renderReport(vulns(7));
      const search = screen.getByPlaceholderText("Search dependencies...");
      fireEvent.change(search, { target: { value: "pkg" } });
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText(summaryText(6, 7, 7))).toBeInTheDocument();

      fireEvent.change(search, { target: { value: "PKG-" } });
      expect(search).toHaveValue("PKG-");
      // Matching is case-insensitive and the page is unchanged.
      expect(screen.getByText(summaryText(6, 7, 7))).toBeInTheDocument();
      expect(screen.getByText("pkg-6")).toBeInTheDocument();
    });

    it("toggles a severity filter off when its card is clicked again, keeping the page", () => {
      renderReport([...vulns(6, "HIGH"), { ...vulns(1)[0], name: "crit", severity: "CRITICAL" }]);
      const high = screen.getByRole("button", { name: /^High/ });

      fireEvent.click(high);
      expect(high).toHaveClass("bg-orange-50");
      expect(screen.queryByText("crit")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText(summaryText(6, 6, 6))).toBeInTheDocument();

      fireEvent.click(high);
      expect(high).not.toHaveClass("bg-orange-50");
      // Clearing the filter does not reset the page.
      expect(screen.getByText(summaryText(6, 7, 7))).toBeInTheDocument();
    });

    it("shows an ellipsis and a last-page shortcut for long lists", () => {
      renderReport(vulns(17));
      expect(screen.getByText("...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
      // Page 4 is only reachable through the last-page shortcut from page 1.
      expect(
        screen.getAllByRole("button", { name: /^\d$/ }).map((b) => b.textContent),
      ).toEqual(["1", "2", "3", "4"]);

      fireEvent.click(screen.getByRole("button", { name: "4" }));
      expect(screen.getByText(summaryText(16, 17, 17))).toBeInTheDocument();
      expect(screen.queryByText("...")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      expect(screen.getByText(summaryText(11, 15, 17))).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Previous" }));
      expect(screen.getByText(summaryText(6, 10, 17))).toBeInTheDocument();

      // A numbered page button jumps straight to that page.
      fireEvent.click(screen.getByRole("button", { name: "3" }));
      expect(screen.getByText(summaryText(11, 15, 17))).toBeInTheDocument();
    });
  });
});
