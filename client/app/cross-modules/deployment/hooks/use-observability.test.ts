import { createWrapper } from "@/test-utils/test-providers/query-client";
import { focusManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_BUILD_ID,
  mockObservabilityServiceFactory,
} from "../test-utils/__mocks__";
import { observabilityService } from "@blocks-deployment/services/observability.service";
import {
  getReportRefetchInterval,
  REPORT_POLL_INTERVAL_MS,
  useGetSASTData,
  useGetSCALibraryData,
  useSCARedirectLink,
  useSASTRedirectLink,
} from "./use-observability";

vi.mock("@blocks-deployment/services/observability.service", () =>
  mockObservabilityServiceFactory(),
);

describe("Observability Hooks", () => {
  // ─── useGetSASTData ─────────────────────────────────────────────────────────

  describe("useGetSASTData", () => {
    it("should fetch SAST data successfully", async () => {
      vi.mocked(observabilityService.SASTData).mockResolvedValue("sast-report");

      const { result } = renderHook(() => useGetSASTData(MOCK_BUILD_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("sast-report");
      expect(observabilityService.SASTData).toHaveBeenCalledWith(MOCK_BUILD_ID);
    });
  });

  // ─── useGetSCALibraryData ──────────────────────────────────────────────────

  describe("useGetSCALibraryData", () => {
    it("should fetch SCA library data successfully", async () => {
      vi.mocked(observabilityService.SCAData).mockResolvedValue(
        "sca-library-report" as never,
      );

      const { result } = renderHook(() => useGetSCALibraryData(MOCK_BUILD_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("sca-library-report");
      expect(observabilityService.SCAData).toHaveBeenCalledWith(
        MOCK_BUILD_ID,
        "libraries",
      );
    });
  });

  // ─── useSCARedirectLink ────────────────────────────────────────────────────

  describe("useSCARedirectLink", () => {
    it("should fetch SCA redirect link successfully", async () => {
      vi.mocked(observabilityService.SCARedirect).mockResolvedValue(
        "sca-redirect-url",
      );

      const { result } = renderHook(() => useSCARedirectLink(MOCK_BUILD_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("sca-redirect-url");
      expect(observabilityService.SCARedirect).toHaveBeenCalledWith(
        MOCK_BUILD_ID,
      );
    });
  });

  // ─── useSASTRedirectLink ───────────────────────────────────────────────────

  describe("useSASTRedirectLink", () => {
    it("should fetch SAST redirect link successfully", async () => {
      vi.mocked(observabilityService.SASTRedirect).mockResolvedValue(
        "sast-redirect-url",
      );

      const { result } = renderHook(() => useSASTRedirectLink(MOCK_BUILD_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("sast-redirect-url");
      expect(observabilityService.SASTRedirect).toHaveBeenCalledWith(
        MOCK_BUILD_ID,
      );
    });
  });

  // ─── Saved-report polling (#255 H10, H11) ──────────────────────────────────

  describe("getReportRefetchInterval", () => {
    const withStatus = (status?: string | null) =>
      ({ state: { data: { data: { status } } } }) as Parameters<typeof getReportRefetchInterval>[0];

    it("polls every 30 seconds while the report is Pending", () => {
      expect(REPORT_POLL_INTERVAL_MS).toBe(30_000);
      expect(getReportRefetchInterval(withStatus("Pending"))).toBe(30_000);
    });

    it.each(["Ready", "NotRun", "Failed", null, undefined])(
      "does not poll when the status is %s",
      (status) => {
        expect(getReportRefetchInterval(withStatus(status))).toBe(false);
      },
    );

    it("does not poll before data arrives or for a legacy payload", () => {
      expect(getReportRefetchInterval({ state: { data: undefined } })).toBe(false);
      expect(getReportRefetchInterval({ state: { data: { data: null } } })).toBe(false);
    });
  });

  describe.each([
    {
      name: "useGetSASTData",
      useHook: () => useGetSASTData(MOCK_BUILD_ID),
      fetcher: () => vi.mocked(observabilityService.SASTData),
    },
    {
      name: "useGetSCALibraryData",
      useHook: () => useGetSCALibraryData(MOCK_BUILD_ID),
      fetcher: () => vi.mocked(observabilityService.SCAData),
    },
  ])("$name polling", ({ useHook, fetcher }) => {
    afterEach(() => {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    });

    const pending = { data: { type: "SAST", status: "Pending", details: null } };
    const ready = { data: { type: "SAST", status: "Ready", details: { ncloc: "10" } } };

    it("refetches every 30 s while Pending and stops once the report is Ready", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fetcher().mockReset();
      fetcher()
        .mockResolvedValueOnce(pending as never)
        .mockResolvedValueOnce(pending as never)
        .mockResolvedValue(ready as never);

      const { result } = renderHook(useHook, { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(pending);
      expect(fetcher()).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(29_000);
      expect(fetcher()).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      await waitFor(() => expect(fetcher()).toHaveBeenCalledTimes(2));

      // The interval restarts when each response lands, a moment after the 30 s tick.
      await vi.advanceTimersByTimeAsync(31_000);
      await waitFor(() => expect(result.current.data).toEqual(ready));
      expect(fetcher()).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(90_000);
      expect(fetcher()).toHaveBeenCalledTimes(3);
    });

    it("does not poll a legacy report without a status", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fetcher().mockReset();
      fetcher().mockResolvedValue({ data: { details: { ncloc: "10" } } } as never);

      const { result } = renderHook(useHook, { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      await vi.advanceTimersByTimeAsync(90_000);
      expect(fetcher()).toHaveBeenCalledTimes(1);
    });

    it("pauses polling while the document is hidden", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fetcher().mockReset();
      fetcher().mockResolvedValue(pending as never);

      const { result } = renderHook(useHook, { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(90_000);
      expect(fetcher()).toHaveBeenCalledTimes(1);
    });

    it("stops polling when the tab unmounts", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      fetcher().mockReset();
      fetcher().mockResolvedValue(pending as never);

      const { result, unmount } = renderHook(useHook, { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      unmount();
      await vi.advanceTimersByTimeAsync(90_000);
      expect(fetcher()).toHaveBeenCalledTimes(1);
    });
  });
});
