import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { SERVICE_REGISTRY_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import { serviceRegistryService } from "./service-registry.service";
import type { IGetAllServicesPayload } from "../models/service.model";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("ServiceRegistryService", () => {
  beforeEach(() => {
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("getAllServices posts the payload to the GetAll endpoint", async () => {
    const payload = {
      projectKey: "pk",
      page: 0,
      pageSize: 10,
    } as IGetAllServicesPayload;
    await serviceRegistryService.getAllServices(payload);
    expect(http.post).toHaveBeenCalledWith(
      SERVICE_REGISTRY_ENDPOINTS.GET_ALL,
      payload,
    );
  });
});
