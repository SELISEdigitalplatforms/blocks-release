import { fireEvent, screen } from "@testing-library/react";
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

  it("redirects to Dependency Track when the button is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const refetch = vi.fn().mockResolvedValue({ data: {} });
    vi.mocked(useSCARedirectLink).mockReturnValue({
      isLoading: false,
      refetch,
    } as never);
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
    fireEvent.click(
      screen.getByRole("button", { name: /Dependency Track/i }),
    );
    await vi.waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
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
