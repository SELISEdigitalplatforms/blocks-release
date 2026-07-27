import { describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import {
  mockAlert,
  MOCK_MONITOR_ID,
  MOCK_REPO_ID,
  mockSuccessResponse,
  mockDeleteSuccessResponse,
} from "../test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { ALERT_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import { alertsService } from "./alerts.service";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("AlertsService", () => {
  // ─── updateSingleMonitor ───────────────────────────────────────────────────

  describe("updateSingleMonitor", () => {
    it("should call correct endpoint with payload", async () => {
      const mockResponse = {
        ...mockSuccessResponse,
        data: mockAlert,
        statusCode: 200,
      };
      vi.mocked(http.post).mockResolvedValue(mockResponse);

      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      const result = await alertsService.updateSingleMonitor(payload);

      expect(http.post).toHaveBeenCalledWith(
        ALERT_ENDPOINTS.UPDATE_MONITOR,
        payload,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── deleteSingleMonitor ────────────────────────────────────────────────────

  describe("deleteSingleMonitor", () => {
    it("should call correct endpoint with itemId", async () => {
      const mockResponse = {
        ...mockDeleteSuccessResponse,
        data: null,
        statusCode: 200,
      };
      vi.mocked(http.delete).mockResolvedValue(mockResponse);

      const result = await alertsService.deleteSingleMonitor(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.DELETE_MONITOR}?itemId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(http.delete).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getMonitorListById ─────────────────────────────────────────────────────

  describe("getMonitorListById", () => {
    it("should call correct endpoint with projectKey and repoId", async () => {
      vi.mocked(http.get).mockResolvedValue(mockSuccessResponse);

      const result = await alertsService.getMonitorListById(
        TEST_PROJECT_KEY,
        MOCK_REPO_ID,
      );

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}&repoId=${MOCK_REPO_ID}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── updateHealth ──────────────────────────────────────────────────────────

  describe("updateHealth", () => {
    it("should call correct endpoint with payload", async () => {
      const mockResponse = { ...mockSuccessResponse, data: {} };
      vi.mocked(http.post).mockResolvedValue(mockResponse);

      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      const result = await alertsService.updateHealth(payload);

      expect(http.post).toHaveBeenCalledWith(
        ALERT_ENDPOINTS.UPDATE_HEALTH,
        payload,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── deleteHealth ──────────────────────────────────────────────────────────

  describe("deleteHealth", () => {
    it("should call correct endpoint with itemId", async () => {
      const mockResponse = { ...mockDeleteSuccessResponse, data: null };
      vi.mocked(http.delete).mockResolvedValue(mockResponse);

      const result = await alertsService.deleteHealth(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(http.delete).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });
});
