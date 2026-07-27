import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MOCK_MONITOR_ID,
  MOCK_REPO_ID,
  mockAlertsServiceFactory,
} from "../test-utils/__mocks__";
import { alertsService } from "@blocks-deployment/services/alerts.service";
import {
  useUpdateSingleMonitor,
  useDeleteMonitor,
  useGetMonitorListById,
  useUpdateHealth,
  useDeleteHealth,
} from "./use-alerts";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("@blocks-deployment/services/alerts.service", () =>
  mockAlertsServiceFactory(),
);

describe("Alert Hooks", () => {
  // ─── useUpdateSingleMonitor ────────────────────────────────────────────────

  describe("useUpdateSingleMonitor", () => {
    it("should call updateSingleMonitor and invalidate queries on success", async () => {
      const payload = { itemId: MOCK_MONITOR_ID, isActive: false };
      vi.mocked(alertsService.updateSingleMonitor).mockResolvedValue({
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

  // ─── useDeleteMonitor ──────────────────────────────────────────────────────

  describe("useDeleteMonitor", () => {
    it("should call deleteSingleMonitor and invalidate queries on success", async () => {
      vi.mocked(alertsService.deleteSingleMonitor).mockResolvedValue({
        data: null,
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

  // ─── useGetMonitorListById ─────────────────────────────────────────────────

  describe("useGetMonitorListById", () => {
    it("should fetch the monitor list for a repo", async () => {
      const mockResponse = { data: [] };
      vi.mocked(alertsService.getMonitorListById).mockResolvedValue(
        mockResponse as any,
      );

      const { result } = renderHook(
        () => useGetMonitorListById(TEST_PROJECT_KEY, MOCK_REPO_ID),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(alertsService.getMonitorListById).toHaveBeenCalledWith(
        TEST_PROJECT_KEY,
        MOCK_REPO_ID,
      );
    });

    it("should not fetch when projectKey or repoId is missing", () => {
      const { result } = renderHook(() => useGetMonitorListById("", ""), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(alertsService.getMonitorListById).not.toHaveBeenCalled();
    });
  });

  // ─── useUpdateHealth ───────────────────────────────────────────────────────

  describe("useUpdateHealth", () => {
    it("should call updateHealth and invalidate queries on success", async () => {
      const payload = { itemId: MOCK_MONITOR_ID, isActive: true };
      vi.mocked(alertsService.updateHealth).mockResolvedValue({
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
    it("should call deleteHealth and invalidate queries on success", async () => {
      vi.mocked(alertsService.deleteHealth).mockResolvedValue({
        data: null,
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
