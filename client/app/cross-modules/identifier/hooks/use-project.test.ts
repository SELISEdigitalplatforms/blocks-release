import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";

const { storeState, useProjectStore, projectService } = vi.hoisted(() => {
  const state = {
    projects: [] as Array<{ itemId: string }>,
    selectedProject: null as { itemId: string } | null,
    setProjects: vi.fn((p: Array<{ itemId: string }>) => {
      state.projects = p;
    }),
    setSelectedProject: vi.fn((p: { itemId: string }) => {
      state.selectedProject = p;
    }),
  };
  const useStore = vi.fn((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  ) as unknown as {
    (selector?: (s: typeof state) => unknown): unknown;
    getState: () => typeof state;
  };
  useStore.getState = () => state;
  return {
    storeState: state,
    useProjectStore: useStore,
    projectService: {
      getProjects: vi.fn(),
      getProject: vi.fn(),
      getEnvRepositories: vi.fn(),
      addAssets: vi.fn(),
    },
  };
});

vi.mock("@/store/project.store", () => ({ useProjectStore }));
vi.mock("@/cross-modules/identifier/services/project.service", () => ({
  projectService,
}));
vi.mock("@blocks-identifier/services/project.service", () => ({
  projectService,
}));

import {
  useAddAssets,
  useGetEnvRepositories,
  useGetProject,
  useGetProjects,
} from "./use-project";

describe("use-project hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.projects = [];
    storeState.selectedProject = null;
  });

  it("useGetProjects flattens groups and seeds the store", async () => {
    projectService.getProjects.mockResolvedValue([
      { projects: [{ itemId: "a" }, { itemId: "b" }] },
    ]);
    const { result } = renderHook(
      () => useGetProjects({ tenantGroupId: "tg1" }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(storeState.setProjects).toHaveBeenCalledWith([
        { itemId: "a" },
        { itemId: "b" },
      ]),
    );
    expect(storeState.setSelectedProject).toHaveBeenCalledWith({ itemId: "a" });
  });

  it("useGetProjects can be disabled", () => {
    const { result } = renderHook(
      () => useGetProjects({ enabled: false }),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetProject fetches when a projectId is present", async () => {
    projectService.getProject.mockResolvedValue({ data: {} });
    const { result } = renderHook(
      () => useGetProject({ projectId: "p1" }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectService.getProject).toHaveBeenCalledWith({ projectId: "p1" });
  });

  it("useGetProject is idle without a projectId", () => {
    const { result } = renderHook(() => useGetProject({ projectId: "" }), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetEnvRepositories fetches repositories", async () => {
    projectService.getEnvRepositories.mockResolvedValue({
      data: [],
      errors: null,
      isSuccess: true,
    });
    const { result } = renderHook(() => useGetEnvRepositories("pk"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectService.getEnvRepositories).toHaveBeenCalled();
  });

  it("useAddAssets posts assets", async () => {
    projectService.addAssets.mockResolvedValue({ errors: null, isSuccess: true });
    const { result } = renderHook(() => useAddAssets(), {
      wrapper: createWrapper(),
    });
    result.current.mutate({ tenantGroupId: "tg1", resource: {} } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectService.addAssets).toHaveBeenCalled();
  });
});
