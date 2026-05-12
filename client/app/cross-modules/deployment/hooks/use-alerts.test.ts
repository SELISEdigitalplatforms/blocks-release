import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  mockAlert,
  mockMonitorList,
  MOCK_MONITOR_ID,
  MOCK_REPO_ID,
  mockAlertsServiceFactory,
} from "../test-utils/__mocks__";
import { alertsService } from "@blocks-deployment/services/alerts.service";
import {
  useAddSingleMonitor,
  useUpdateSingleMonitor,
  useDeleteMonitor,
  useGetMonitorList,
  useGetHealthMonitorList,
  useGetMonitorListById,
  useGetMonitorDetails,
  useGetAllIncidentList,
  useGetMonitorById,
  useGetMonitorResponseTime,
  useGetMonitorDownTime,
  useSaveHealth,
  useUpdateHealth,
  useDeleteHealth,
} from "./alerts";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("@blocks-deployment/services/alerts.service", () =>
  mockAlertsServiceFactory(),
);

describe("Alert Hooks", () => {
  // ─── useAddSingleMonitor ───────────────────────────────────────────────────

  describe("useAddSingleMonitor", () => {
    it("should call addSingleMonitor and invalidate queries on success", async () => {
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
      vi.mocked(alertsService.addSingleMonitor).mockResolvedValue({
        data: { itemId: MOCK_MONITOR_ID },
        isSuccess: true,
      } as any);

      const { result } = renderHook(() => useAddSingleMonitor(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.addSingleMonitor).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useGetMonitorList ─────────────────────────────────────────────────────

  describe("useGetMonitorList", () => {
    it("should fetch monitor list successfully", async () => {
      vi.mocked(alertsService.getMonitorListById).mockResolvedValue(
        mockMonitorList,
      );

      const { result } = renderHook(
        () => useGetMonitorList(TEST_PROJECT_KEY, MOCK_REPO_ID),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockMonitorList);
      expect(alertsService.getMonitorListById).toHaveBeenCalledWith(
        TEST_PROJECT_KEY,
        MOCK_REPO_ID,
      );
    });
  });

  // ─── useDeleteMonitor ──────────────────────────────────────────────────────

  describe("useDeleteMonitor", () => {
    it("should call deleteSingleMonitor on success", async () => {
      vi.mocked(alertsService.deleteSingleMonitor).mockResolvedValue({
        isSuccess: true,
      } as any);

      const { result } = renderHook(() => useDeleteMonitor(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(MOCK_MONITOR_ID);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.deleteSingleMonitor).toHaveBeenCalledWith(
        MOCK_MONITOR_ID,
      );
    });
  });

  // ─── useGetMonitorDetails ──────────────────────────────────────────────────

  describe("useGetMonitorDetails", () => {
    it("should fetch monitor details successfully", async () => {
      const mockDetails = { data: {}, isSuccess: true };
      vi.mocked(alertsService.getMonitorDetails).mockResolvedValue(
        mockDetails as any,
      );

      const { result } = renderHook(
        () => useGetMonitorDetails(MOCK_MONITOR_ID),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDetails);
    });
  });

  // ─── useGetMonitorById ─────────────────────────────────────────────────────

  describe("useGetMonitorById", () => {
    it("should fetch monitor by id successfully", async () => {
      vi.mocked(alertsService.getMonitorById).mockResolvedValue({
        data: mockAlert,
        isSuccess: true,
      } as any);

      const { result } = renderHook(() => useGetMonitorById(MOCK_MONITOR_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toEqual(mockAlert);
    });
  });

  // ─── useGetMonitorResponseTime ──────────────────────────────────────────────

  describe("useGetMonitorResponseTime", () => {
    it("should fetch monitor response time successfully", async () => {
      const option = {
        monitorId: MOCK_MONITOR_ID,
        timeRange: "1h",
        interval: 60,
      };
      vi.mocked(alertsService.GetMonitorResponseTime).mockResolvedValue({
        data: [],
        isSuccess: true,
      } as any);

      const { result } = renderHook(() => useGetMonitorResponseTime(option), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.GetMonitorResponseTime).toHaveBeenCalledWith(
        expect.objectContaining({
          monitorId: MOCK_MONITOR_ID,
        }),
      );
    });
  });

  // ─── useSaveHealth ─────────────────────────────────────────────────────────

  describe("useSaveHealth", () => {
    it("should call saveHealth on success", async () => {
      const payload = { name: "health", isActive: true };
      vi.mocked(alertsService.saveHealth).mockResolvedValue({
        isSuccess: true,
        data: { itemId: MOCK_MONITOR_ID },
      } as any);

      const { result } = renderHook(() => useSaveHealth(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.saveHealth).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useUpdateSingleMonitor ────────────────────────────────────────────────

  describe("useUpdateSingleMonitor", () => {
    it("should call updateSingleMonitor on success", async () => {
      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      vi.mocked(alertsService.updateSingleMonitor).mockResolvedValue({
        isSuccess: true,
        data: { itemId: MOCK_MONITOR_ID },
      } as any);

      const { result } = renderHook(() => useUpdateSingleMonitor(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.updateSingleMonitor).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useGetHealthMonitorList ───────────────────────────────────────────────

  describe("useGetHealthMonitorList", () => {
    it("should fetch health monitor list successfully", async () => {
      vi.mocked(alertsService.getHealthMonitorList).mockResolvedValue(
        mockMonitorList,
      );

      const { result } = renderHook(
        () => useGetHealthMonitorList(TEST_PROJECT_KEY, 1, 1, 10),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockMonitorList);
      expect(alertsService.getHealthMonitorList).toHaveBeenCalledWith(
        TEST_PROJECT_KEY,
        1,
        1,
        10,
      );
    });
  });

  // ─── useGetMonitorListById ─────────────────────────────────────────────────

  describe("useGetMonitorListById", () => {
    it("should fetch monitor list by id successfully", async () => {
      vi.mocked(alertsService.getMonitorListById).mockResolvedValue(
        mockMonitorList,
      );

      const { result } = renderHook(
        () => useGetMonitorListById(TEST_PROJECT_KEY, MOCK_REPO_ID),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockMonitorList);
      expect(alertsService.getMonitorListById).toHaveBeenCalledWith(
        TEST_PROJECT_KEY,
        MOCK_REPO_ID,
      );
    });
  });

  // ─── useGetAllIncidentList ────────────────────────────────────────────────

  describe("useGetAllIncidentList", () => {
    it("should fetch all incident list successfully", async () => {
      const mockResponse = { data: [], isSuccess: true };
      vi.mocked(alertsService.getAllMonitorIncidentList).mockResolvedValue(
        mockResponse as any,
      );

      const { result } = renderHook(
        () => useGetAllIncidentList(MOCK_MONITOR_ID, 1, 10),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(alertsService.getAllMonitorIncidentList).toHaveBeenCalledWith(
        MOCK_MONITOR_ID,
        1,
        10,
      );
    });
  });

  // ─── useGetMonitorDownTime ─────────────────────────────────────────────────

  describe("useGetMonitorDownTime", () => {
    it("should fetch monitor down time successfully", async () => {
      const option = {
        monitorId: MOCK_MONITOR_ID,
        timeRange: "1h",
        interval: 60,
      };
      vi.mocked(alertsService.GetMonitorDownTime).mockResolvedValue({
        data: [],
        isSuccess: true,
      } as any);

      const { result } = renderHook(() => useGetMonitorDownTime(option), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.GetMonitorDownTime).toHaveBeenCalledWith(
        expect.objectContaining({
          monitorId: MOCK_MONITOR_ID,
        }),
      );
    });
  });

  // ─── useUpdateHealth ───────────────────────────────────────────────────────

  describe("useUpdateHealth", () => {
    it("should call updateHealth on success", async () => {
      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      vi.mocked(alertsService.updateHealth).mockResolvedValue({
        isSuccess: true,
        data: { tenantId: TEST_PROJECT_KEY },
      } as any);

      const { result } = renderHook(() => useUpdateHealth(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.updateHealth).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useDeleteHealth ───────────────────────────────────────────────────────

  describe("useDeleteHealth", () => {
    it("should call deleteHealth on success", async () => {
      vi.mocked(alertsService.deleteHealth).mockResolvedValue({
        isSuccess: true,
      } as any);

      const { result } = renderHook(() => useDeleteHealth(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(MOCK_MONITOR_ID);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(alertsService.deleteHealth).toHaveBeenCalledWith(MOCK_MONITOR_ID);
    });
  });
});
