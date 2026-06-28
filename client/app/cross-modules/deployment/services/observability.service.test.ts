import { describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import { observabilityService } from "./observability.service";
import { MOCK_BUILD_ID } from "../test-utils/__mocks__";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("ObservabilityService", () => {
  // ─── SASTData ──────────────────────────────────────────────────────────────

  describe("SASTData", () => {
    it("should call correct endpoint with buildId", async () => {
      const mockResponse = "sast-report-url";
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await observabilityService.SASTData(MOCK_BUILD_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPORTS}?buildId=${encodeURIComponent(MOCK_BUILD_ID)}&type=sast`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── SCAData ───────────────────────────────────────────────────────────────

  describe("SCAData", () => {
    it("should call correct endpoint with buildId and type", async () => {
      const type = "npm";
      const mockResponse = "sca-report-url";
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await observabilityService.SCAData(MOCK_BUILD_ID, type);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPORTS}?buildId=${encodeURIComponent(MOCK_BUILD_ID)}&type=sca-${encodeURIComponent(type)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── SCARedirect ───────────────────────────────────────────────────────────

  describe("SCARedirect", () => {
    it("should call correct endpoint with buildId", async () => {
      const mockResponse = "redirect-url";
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await observabilityService.SCARedirect(MOCK_BUILD_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.PROCESS_DEPENDENCY_TRACK_USER}?buildId=${encodeURIComponent(MOCK_BUILD_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── SASTRedirect ──────────────────────────────────────────────────────────

  describe("SASTRedirect", () => {
    it("should call correct endpoint with buildId", async () => {
      const mockResponse = "redirect-url";
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await observabilityService.SASTRedirect(MOCK_BUILD_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.PROCESS_SONARQUBE_USER}?buildId=${encodeURIComponent(MOCK_BUILD_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });
});
