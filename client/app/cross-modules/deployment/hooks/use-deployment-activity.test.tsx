import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDeploymentActivity } from "./use-deployment-activity";
import { getDeploymentActivity } from "../services/deployment-activity.service";

const state = vi.hoisted(() => ({ project: "project-a" }));
vi.mock("@/store/project.store", () => ({
  useProjectStore: (select: (store: { selectedProject: { tenantId: string } }) => string) =>
    select({ selectedProject: { tenantId: state.project } }),
}));
vi.mock("../services/deployment-activity.service", () => ({ getDeploymentActivity: vi.fn() }));

describe("deployment activity query isolation", () => {
  it("scopes cache entries to project, repository and branch, and refreshes after deployment invalidation", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const load = vi.mocked(getDeploymentActivity);
    load.mockReset();
    load.mockImplementation(async () => ({
      days: [{ date: "2026-10-11", count: load.mock.calls.length }],
      builds: [],
    }));
    state.project = "project-a";
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(
      ({ repo, branch }) => useDeploymentActivity(repo, branch, "2026-10-11"),
      { wrapper, initialProps: { repo: "179", branch: "main" } },
    );
    await waitFor(() => expect(result.current.data?.days[0].count).toBe(1));
    state.project = "project-b";
    rerender({ repo: "179", branch: "main" });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.days[0].count).toBe(2));
    rerender({ repo: "180", branch: "main" });
    await waitFor(() => expect(result.current.data?.days[0].count).toBe(3));
    rerender({ repo: "180", branch: "dev" });
    await waitFor(() => expect(result.current.data?.days[0].count).toBe(4));
    await client.invalidateQueries({ queryKey: ["repo-details", "180"] });
    await waitFor(() => expect(result.current.data?.days[0].count).toBe(5));
    expect(
      client.getQueryData(["repo-details", "179", "project-a", "activity", "main", "2026-10-11"]),
    ).toEqual({ days: [{ date: "2026-10-11", count: 1 }], builds: [] });
    unmount();
    client.clear();
  });
});
