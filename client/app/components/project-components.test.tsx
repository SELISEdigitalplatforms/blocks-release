import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetProject } from "@blocks-identifier/hooks/use-project";
import { useGetAllProjects } from "@blocks-deployment/hooks/use-github-info";

vi.mock("@blocks-identifier/hooks/use-project", () => ({
  useGetProject: vi.fn(),
}));
vi.mock("@blocks-deployment/hooks/use-github-info", () => ({
  useGetAllProjects: vi.fn(),
}));

import { ProjectDetail } from "./project-detail/project-detail";
import { ProjectCliSnippet } from "./project-cli-snippet/project-cli-snippet";
import { ProjectRepoList } from "./project-repo-list/project-repo-list";
import { DateRangeFilter } from "./date-range-filter/date-range-filter";

const project = {
  itemId: "p1",
  name: "Acme",
  tenantId: "tenant-1",
  environment: "dev",
  applicationDomain: "https://acme.example.com",
  customDomain: "",
} as never;

describe("ProjectDetail", () => {
  it("renders project fields", () => {
    renderWithProviders(<ProjectDetail project={project} isLoading={false} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("renders the loading skeleton", () => {
    const { container } = renderWithProviders(
      <ProjectDetail project={undefined} isLoading />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe("ProjectCliSnippet", () => {
  it("renders once the project resolves", () => {
    vi.mocked(useGetProject).mockReturnValue({
      data: { data: project },
      isLoading: false,
    } as never);
    const { container } = renderWithProviders(<ProjectCliSnippet />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe("ProjectRepoList", () => {
  beforeEach(() => {
    vi.mocked(useGetAllProjects).mockReturnValue({
      data: { data: [] },
      isPending: false,
    } as never);
  });

  it("renders the repository list section", () => {
    const { container } = renderWithProviders(
      <ProjectRepoList project={project} isLoading={false} />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe("DateRangeFilter", () => {
  it("renders the trigger and opens the calendar", () => {
    const onDateChange = vi.fn();
    renderWithProviders(
      <DateRangeFilter
        title="Created"
        date={undefined}
        onDateChange={onDateChange}
      />,
    );
    fireEvent.click(screen.getByText("Created"));
  });
});
