import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useGetProject,
  useGetProjects,
} from "@blocks-identifier/hooks/use-project";
import { useProjectStore } from "@/store/project.store";

const navigateMock = vi.fn();
let currentPath = "/app/dashboard";

vi.mock("@blocks-identifier/hooks/use-project", () => ({
  useGetProjects: vi.fn(),
  useGetProject: vi.fn(),
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ pathname: currentPath }),
  };
});

import { EnvironmentList } from "./environment-list";

const projectGroups = [
  {
    projects: [
      { itemId: "p1", name: "My Project", environment: "dev" },
      { itemId: "p-stg", name: "Staging", environment: "staging" },
    ],
  },
];

describe("EnvironmentList", () => {
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
      applications: [{ domain: "app.dev" }],
    } as never);
    vi.mocked(useGetProjects).mockReturnValue({
      data: projectGroups,
      isLoading: false,
    } as never);
    vi.mocked(useGetProject).mockReturnValue({
      data: {
        data: {
          itemId: "p1",
          name: "My Project",
          environment: "dev",
          applications: [{ domain: "app.dev" }],
        },
      },
    } as never);
  });

  it("shows the current environment and domain", () => {
    renderWithProviders(<EnvironmentList />);
    expect(screen.getByText("dev")).toBeInTheDocument();
    expect(screen.getByText("app.dev")).toBeInTheDocument();
  });

  it("selects another environment from the dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<EnvironmentList />);
    await user.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByText("staging"));
    expect(useProjectStore.getState().selectedProject?.itemId).toBe("p-stg");
  });

  it("redirects to deployment home when switching from a repo page", async () => {
    currentPath = "/app/deployment/repo/r1";
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<EnvironmentList />);
    await user.click(screen.getByRole("button"));
    fireEvent.click(await screen.findByText("staging"));
    expect(navigateMock).toHaveBeenCalledWith("/app/deployment", {
      replace: true,
    });
  });
});
