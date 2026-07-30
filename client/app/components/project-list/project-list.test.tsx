import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetProject,
  useGetProjects,
} from "@/cross-modules/identifier/hooks/use-project";
import { useProjectStore } from "@/store/project.store";

const navigateMock = vi.fn();
let currentPath = "/app/dashboard";

vi.mock("@/cross-modules/identifier/hooks/use-project", () => ({
  useGetProjects: vi.fn(),
  useGetProject: vi.fn(),
}));
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: currentPath }),
  };
});

import { ProjectList } from "./project-list";

const projectGroups = [
  { projects: [{ itemId: "p-other", name: "Other Project" }] },
];

describe("ProjectList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPath = "/app/dashboard";
    useProjectStore.getState().setSelectedProject({
      itemId: "p1",
      tenantId: "t1",
      tenantGroupId: "g1",
      name: "My Project",
      applicationDomain: "",
      customDomain: "",
      isProduction: false,
      environment: "dev",
      tenantSlug: "s",
    });
    vi.mocked(useGetProjects).mockReturnValue({
      data: projectGroups,
      isLoading: false,
    } as never);
    vi.mocked(useGetProject).mockReturnValue({
      data: { data: { name: "My Project" } },
    } as never);
  });

  it("shows the selected project name", () => {
    renderWithProviders(<ProjectList />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
  });

  it("selects another project from the dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<ProjectList />);
    await user.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByText("Other Project"));
    expect(useProjectStore.getState().selectedProject?.itemId).toBe("p-other");
  });

  it("redirects to deployment home when switching from a repo page", async () => {
    currentPath = "/app/deployment/repo/r1";
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<ProjectList />);
    await user.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByText("Other Project"));
    expect(navigateMock).toHaveBeenCalledWith("/app/deployment", {
      replace: true,
    });
  });
});
