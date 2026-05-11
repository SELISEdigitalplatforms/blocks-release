import { describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import {
  mockAlert,
  mockMonitorList,
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
  // ─── addSingleMonitor ──────────────────────────────────────────────────────

  describe("addSingleMonitor", () => {
    it("should call correct endpoint with payload", async () => {
      const mockResponse = {
        ...mockSuccessResponse,
        data: mockAlert,
        statusCode: 200,
      };
      vi.mocked(http.post).mockResolvedValue(mockResponse);

      const payload = {
        itemId: MOCK_MONITOR_ID,
        projectKey: TEST_PROJECT_KEY,
        repoId: MOCK_REPO_ID,
        repoName: "repo",
        name: "monitor",
        url: "https://test.com",
        monitorType: "1",
        protocolType: "1",
        httpMethodType: "1",
        intervalInSeconds: 60,
        timeoutInSeconds: 30,
        isActive: true,
        customHttpHeaders: "",
        customPayload: "",
      };
      const result = await alertsService.addSingleMonitor(payload);

      expect(http.post).toHaveBeenCalledWith(
        ALERT_ENDPOINTS.SAVE_MONITOR,
        payload,
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getMonitorList ────────────────────────────────────────────────────────

  describe("getMonitorList", () => {
    it("should call correct endpoint with projectKey", async () => {
      vi.mocked(http.get).mockResolvedValue(mockMonitorList);

      const result = await alertsService.getMonitorList(TEST_PROJECT_KEY);

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockMonitorList);
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

  // ─── getMonitorListById ─────────────────────────────────────────────────────

  describe("getMonitorListById", () => {
    it("should call correct endpoint with projectKey and repoId", async () => {
      vi.mocked(http.get).mockResolvedValue(mockMonitorList);

      const result = await alertsService.getMonitorListById(
        TEST_PROJECT_KEY,
        MOCK_REPO_ID,
      );

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}&repoId=${MOCK_REPO_ID}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockMonitorList);
    });
  });

  // ─── getMonitorDetails ──────────────────────────────────────────────────────

  describe("getMonitorDetails", () => {
    it("should call correct endpoint with monitorId", async () => {
      const mockResponse = { ...mockSuccessResponse, data: {} };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await alertsService.getMonitorDetails(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_DETAILS}?monitorId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── isExternalServiceConfigured ───────────────────────────────────────────

  describe("isExternalServiceConfigured", () => {
    it("should call correct endpoint with externalServiceId", async () => {
      const externalServiceId = "ext-service-uuid";
      const mockResponse = { ...mockSuccessResponse, data: {} };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result =
        await alertsService.isExternalServiceConfigured(externalServiceId);

      const expectedUrl = `${ALERT_ENDPOINTS.IS_EXTERNAL_SERVICE_CONFIGURED}?externalServiceId=${encodeURIComponent(externalServiceId)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getHealthMonitorList ───────────────────────────────────────────────────

  describe("getHealthMonitorList", () => {
    it("should call correct endpoint with params", async () => {
      vi.mocked(http.get).mockResolvedValue(mockMonitorList);

      const monitorSourceType = 1;
      const pageNumber = 1;
      const pageSize = 20;
      const result = await alertsService.getHealthMonitorList(
        TEST_PROJECT_KEY,
        monitorSourceType,
        pageNumber,
        pageSize,
      );

      const expectedParams = new URLSearchParams({
        projectKey: TEST_PROJECT_KEY,
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
        monitorSourceType: monitorSourceType.toString(),
      });
      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?${expectedParams.toString()}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockMonitorList);
    });

    it("should handle missing monitorSourceType", async () => {
      vi.mocked(http.get).mockResolvedValue(mockMonitorList);

      await alertsService.getHealthMonitorList(TEST_PROJECT_KEY);

      const expectedParams = new URLSearchParams({
        projectKey: TEST_PROJECT_KEY,
        pageNumber: "0",
        pageSize: "10",
      });
      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_LIST}?${expectedParams.toString()}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
    });
  });

  // ─── getAllMonitorIncidentList ──────────────────────────────────────────────

  describe("getAllMonitorIncidentList", () => {
    it("should call correct endpoint with monitorId and pagination", async () => {
      const mockResponse = { ...mockSuccessResponse, data: [] };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const pageNumber = 2;
      const pageSize = 50;
      const result = await alertsService.getAllMonitorIncidentList(
        MOCK_MONITOR_ID,
        pageNumber,
        pageSize,
      );

      const expectedUrl = `${ALERT_ENDPOINTS.GET_INCIDENT_LIST}?monitorId=${encodeURIComponent(MOCK_MONITOR_ID)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getMonitorById ─────────────────────────────────────────────────────────

  describe("getMonitorById", () => {
    it("should call correct endpoint with monitorId", async () => {
      const mockResponse = { ...mockSuccessResponse, data: mockAlert };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await alertsService.getMonitorById(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_BY_ID}?monitorId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── GetMonitorResponseTime ──────────────────────────────────────────────────

  describe("GetMonitorResponseTime", () => {
    it("should call correct endpoint with payload", async () => {
      const mockResponse = { ...mockSuccessResponse, data: [] };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const payload = {
        monitorId: MOCK_MONITOR_ID,
        startTime: "2023-01-01",
        endTime: "2023-01-02",
      };
      const result = await alertsService.GetMonitorResponseTime(payload);

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_RESPONSE_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startTime=${encodeURIComponent(payload.startTime)}&endTime=${encodeURIComponent(payload.endTime)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── GetMonitorDownTime ──────────────────────────────────────────────────────

  describe("GetMonitorDownTime", () => {
    it("should call correct endpoint with payload", async () => {
      const mockResponse = { ...mockSuccessResponse, data: [] };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const payload = {
        monitorId: MOCK_MONITOR_ID,
        startTime: "2023-01-01",
        endTime: "2023-01-02",
      };
      const result = await alertsService.GetMonitorDownTime(payload);

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_DOWN_TIME}?monitorId=${encodeURIComponent(payload.monitorId)}&startDate=${payload.startTime}&endDate=${payload.endTime}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── saveHealth ────────────────────────────────────────────────────────────

  describe("saveHealth", () => {
    it("should call correct endpoint with payload", async () => {
      const mockResponse = { ...mockSuccessResponse, data: {} };
      vi.mocked(http.post).mockResolvedValue(mockResponse);

      const payload = { name: "health", isActive: true };
      const result = await alertsService.saveHealth(payload);

      expect(http.post).toHaveBeenCalledWith(
        ALERT_ENDPOINTS.SAVE_HEALTH,
        payload,
      );
      expect(result).toEqual(mockResponse);
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
      const mockResponse = { ...mockSuccessResponse, data: null };
      vi.mocked(http.delete).mockResolvedValue(mockResponse);

      const result = await alertsService.deleteHealth(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(http.delete).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });
});
