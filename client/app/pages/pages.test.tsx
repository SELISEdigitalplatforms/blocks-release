import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetProjects } from "@blocks-identifier/hooks/use-project";

vi.mock("@blocks-identifier/hooks/use-project", () => ({
  useGetProjects: vi.fn(),
}));

import Console from "./console/console";
import { DefaultDoc } from "./console/default-doc";
import { SelfProject } from "./console/self-project";
import { EnvironmentsPage } from "./environments/environments";

const projectGroup = {
  tenantGroupId: "tg1",
  projects: [
    { itemId: "p1", tenantGroupId: "tg1", name: "Proj 1", environment: "dev" },
    { itemId: "p2", tenantGroupId: "tg1", name: "Proj 1", environment: "prod" },
  ],
};

describe("DefaultDoc", () => {
  it("renders the documentation cards", () => {
    render(<DefaultDoc />);
    expect(screen.getByText("Docs")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
  });
});

describe("SelfProject", () => {
  it("shows the loading skeleton while fetching", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    } as never);
    const { container } = render(<SelfProject />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows an empty state when there are no projects", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    } as never);
    render(<SelfProject />);
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });

  it("lists project groups", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: [projectGroup],
      isLoading: false,
      isFetching: false,
    } as never);
    renderWithProviders(<SelfProject />);
    expect(screen.getByText("Your Blocks Projects")).toBeInTheDocument();
  });
});

describe("Console", () => {
  it("renders the console shell", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: [projectGroup],
      isLoading: false,
      isFetching: false,
    } as never);
    renderWithProviders(<Console />);
    expect(screen.getByText("Resources")).toBeInTheDocument();
  });
});

describe("EnvironmentsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the loading state", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: [],
      isLoading: true,
    } as never);
    const { container } = render(<EnvironmentsPage />);
    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("renders an empty message when there are no environments", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: [],
      isLoading: false,
    } as never);
    render(<EnvironmentsPage />);
    expect(
      screen.getByText(/no environments found in this project/i),
    ).toBeInTheDocument();
  });

  it("renders environment cards when projects exist", () => {
    vi.mocked(useGetProjects).mockReturnValue({
      data: [projectGroup],
      isLoading: false,
    } as never);
    render(<EnvironmentsPage />);
    expect(screen.getByText("Environments")).toBeInTheDocument();
  });
});
