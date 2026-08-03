import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { serviceRegistryService } from "@blocks-identifier/services/service-registry.service";
import { useGetAllServices } from "./use-services";
import type { IGetAllServicesPayload } from "@blocks-identifier/models/service.model";

vi.mock("@blocks-identifier/services/service-registry.service", () => ({
  serviceRegistryService: { getAllServices: vi.fn() },
}));

describe("useGetAllServices", () => {
  it("fetches services when a project key is present", async () => {
    vi.mocked(serviceRegistryService.getAllServices).mockResolvedValue({
      services: [],
      totalCount: 0,
    } as never);
    const options = {
      projectKey: "pk",
      page: 0,
      pageSize: 10,
    } as IGetAllServicesPayload;
    const { result } = renderHook(() => useGetAllServices(options), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(serviceRegistryService.getAllServices).toHaveBeenCalledWith(options);
  });

  it("does not fetch without a project key", () => {
    const { result } = renderHook(
      () =>
        useGetAllServices({
          projectKey: "",
          page: 0,
          pageSize: 10,
        } as IGetAllServicesPayload),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(serviceRegistryService.getAllServices).not.toHaveBeenCalled();
  });
});
