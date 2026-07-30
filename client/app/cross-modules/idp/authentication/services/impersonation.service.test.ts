import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { IMPERSONATION_ENDPOINTS } from "../constants/endpoint.constant";
import { impersonationService } from "./impersonation.service";
import type { ImpersonationRequest } from "../models/impersonate.model";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("ImpersonationService", () => {
  beforeEach(() => {
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("impersonationStatus posts to the status endpoint", async () => {
    await impersonationService.impersonationStatus();
    expect(http.post).toHaveBeenCalledWith(
      IMPERSONATION_ENDPOINTS.IMPERSONATION_STATUS,
      null,
    );
  });

  it("startImpersonation posts the request", async () => {
    const request = { userId: "u1" } as unknown as ImpersonationRequest;
    await impersonationService.startImpersonation(request);
    expect(http.post).toHaveBeenCalledWith(
      IMPERSONATION_ENDPOINTS.IMPERSONATE,
      request,
    );
  });

  it("stopImpersonation posts to the stop endpoint", async () => {
    await impersonationService.stopImpersonation();
    expect(http.post).toHaveBeenCalledWith(
      IMPERSONATION_ENDPOINTS.STOP_IMPERSONATION,
      {},
    );
  });
});
