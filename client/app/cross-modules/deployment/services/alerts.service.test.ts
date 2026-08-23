import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAlert,
  MOCK_MONITOR_ID,
  MOCK_REPO_ID,
  mockSuccessResponse,
  mockDeleteSuccessResponse,
} from "../test-utils/__mocks__";
import { serviceInstances } from "@/lib/http-client";
import { ALERT_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import { alertsService } from "./alerts.service";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

const httpClientMocks = vi.hoisted(() => {
  const createHttpMock = () => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
  });

  return {
    deploymentService: createHttpMock(),
    logicService: createHttpMock(),
    idpService: createHttpMock(),
  };
});

vi.mock("@/lib/http-client", () => ({
  http: httpClientMocks.deploymentService,
  serviceInstances: httpClientMocks,
  HttpClient: class MockHttpClient {},
  HttpError: class MockHttpError extends Error {
    status: number;
    errors: Record<string, string | string[]>;
    constructor(
      status: number,
      error: { errors: Record<string, string | string[]> },
    ) {
      super(String(error));
      this.status = status;
      this.errors = error.errors;
    }
  },
}));

const deploymentService = vi.mocked(serviceInstances.deploymentService);
const logicService = vi.mocked(serviceInstances.logicService);

describe("AlertsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateSingleMonitor", () => {
    it("calls logicService.post with the update endpoint and payload", async () => {
      const mockResponse = {
        ...mockSuccessResponse,
        data: mockAlert,
        statusCode: 200,
      };
      logicService.post.mockResolvedValue(mockResponse);

      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      const result = await alertsService.updateSingleMonitor(payload);

      expect(logicService.post).toHaveBeenCalledWith(
        ALERT_ENDPOINTS.UPDATE_MONITOR,
        payload,
      );
      expect(deploymentService.post).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteSingleMonitor", () => {
    it("calls logicService.delete with the delete endpoint and itemId", async () => {
      const mockResponse = {
        ...mockDeleteSuccessResponse,
        data: null,
        statusCode: 200,
      };
      logicService.delete.mockResolvedValue(mockResponse);

      const result = await alertsService.deleteSingleMonitor(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.DELETE_MONITOR}?itemId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(logicService.delete).toHaveBeenCalledWith(expectedUrl);
      expect(deploymentService.delete).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getMonitorListById", () => {
    it("calls deploymentService.get and not logicService.get", async () => {
      deploymentService.get.mockResolvedValue(mockSuccessResponse);

      const result = await alertsService.getMonitorListById(
        TEST_PROJECT_KEY,
        MOCK_REPO_ID,
      );

      const expectedUrl = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}&repoId=${encodeURIComponent(MOCK_REPO_ID)}`;
      expect(deploymentService.get).toHaveBeenCalledWith(expectedUrl);
      expect(logicService.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  describe("updateHealth", () => {
    it("calls logicService.post with the health endpoint and payload", async () => {
      const mockResponse = { ...mockSuccessResponse, data: {} };
      logicService.post.mockResolvedValue(mockResponse);

      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      const result = await alertsService.updateHealth(payload);

      expect(logicService.post).toHaveBeenCalledWith(
        ALERT_ENDPOINTS.UPDATE_HEALTH,
        payload,
      );
      expect(deploymentService.post).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe("deleteHealth", () => {
    it("calls logicService.delete with the health delete endpoint and itemId", async () => {
      const mockResponse = { ...mockDeleteSuccessResponse, data: null };
      logicService.delete.mockResolvedValue(mockResponse);

      const result = await alertsService.deleteHealth(MOCK_MONITOR_ID);

      const expectedUrl = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(MOCK_MONITOR_ID)}`;
      expect(logicService.delete).toHaveBeenCalledWith(expectedUrl);
      expect(deploymentService.delete).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });
});
