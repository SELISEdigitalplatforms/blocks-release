import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetProject,
  useGetProjects,
} from "@/cross-modules/identifier/hooks/use-project";

vi.mock("@/cross-modules/identifier/hooks/use-project", () => ({
  useGetProjects: vi.fn(),
  useGetProject: vi.fn(),
}));

import { EnvironmentList } from "./environment-list/environment-list";
import { SelectedEnvironment } from "./environment-list/selected-environment";
import { ProjectList } from "./project-list/project-list";
import { SelectedProject } from "./project-list/selected-project";

const group = {
  tenantGroupId: "test-tenant-group-id",
  projects: [
    {
      itemId: "test-project-id",
      name: "Test Project",
      environment: "dev",
      applications: [{ domain: "dev.example.com" }],
    },
    {
      itemId: "p2",
      name: "Test Project",
      environment: "prod",
      applications: [{ domain: "prod.example.com" }],
    },
  ],
};

describe("list selector dropdowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetProjects).mockReturnValue({
      data: [group],
      isLoading: false,
    } as never);
    vi.mocked(useGetProject).mockReturnValue({
      data: { data: group.projects[0] },
    } as never);
  });

  it("EnvironmentList shows the current environment and opens the menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<EnvironmentList />, { route: "/app/console" });
    expect(screen.getByText("dev")).toBeInTheDocument();
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Your Environments")).toBeInTheDocument();
  });

  it("ProjectList shows the current project and opens the menu", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<ProjectList />, { route: "/app/console" });
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Your Projects")).toBeInTheDocument();
  });

  it("SelectedEnvironment renders the environment badge", () => {
    renderWithProviders(<SelectedEnvironment />);
    expect(screen.getByText("dev")).toBeInTheDocument();
  });

  it("SelectedProject renders the project name", () => {
    renderWithProviders(<SelectedProject />);
    expect(screen.getByText("Test Project")).toBeInTheDocument();
  });
});
