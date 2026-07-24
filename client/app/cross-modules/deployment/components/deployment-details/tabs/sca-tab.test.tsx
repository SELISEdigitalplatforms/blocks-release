import { screen } from "@testing-library/react";
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

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
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
});
