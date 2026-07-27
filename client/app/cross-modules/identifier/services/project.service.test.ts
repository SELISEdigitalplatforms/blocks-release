import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import {
  CLOUD_BUILD_ENDPOINTS,
  PROJECT_ENDPOINTS,
} from "@blocks-identifier/constants/endpoint.constant";
import { projectService } from "./project.service";
import type { IResource } from "@blocks-identifier/models/project.model";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("ProjectService", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockResolvedValue([] as never);
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("getProjects builds a paged url with the tenant group", async () => {
    await projectService.getProjects(0, 100, "tg1");
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain(PROJECT_ENDPOINTS.GETS);
    expect(url).toContain("page=0");
    expect(url).toContain("pageSize=100");
    expect(url).toContain("tenantGroupId=tg1");
  });

  it("getProject requests by projectId", async () => {
    await projectService.getProject({ projectId: "p1" });
    expect(http.get).toHaveBeenCalledWith(`${PROJECT_ENDPOINTS.GET}?projectId=p1`);
  });

  it("getEnvRepositories hits the repos-list endpoint", async () => {
    await projectService.getEnvRepositories();
    expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.REPOS_LIST);
  });

  it("addAssets posts the payload", async () => {
    const payload = { tenantGroupId: "tg1", resource: {} as IResource };
    await projectService.addAssets(payload);
    expect(http.post).toHaveBeenCalledWith(PROJECT_ENDPOINTS.ADD_ASSET, payload);
  });
});
