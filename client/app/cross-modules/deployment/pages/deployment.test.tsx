import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetAllProjects } from "@/cross-modules/deployment/hooks/use-github-info";

vi.mock("@/cross-modules/deployment/hooks/use-github-info", () => ({
  useGetAllProjects: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

import Deployment from "./deployment";

describe("Deployment page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading spinner while projects load", () => {
    vi.mocked(useGetAllProjects).mockReturnValue({
      isPending: true,
    } as never);
    renderWithProviders(<Deployment />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the overview once projects resolve", () => {
    vi.mocked(useGetAllProjects).mockReturnValue({
      data: { data: [] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<Deployment />);
    expect(screen.getByText("Deployment Overview")).toBeInTheDocument();
  });

  it("surfaces an error and still renders the overview", () => {
    vi.mocked(useGetAllProjects).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { errors: { Message: "boom" } },
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<Deployment />);
    expect(screen.getByText("Deployment Overview")).toBeInTheDocument();
  });
});
