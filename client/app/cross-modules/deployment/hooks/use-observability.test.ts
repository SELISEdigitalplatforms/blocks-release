import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MOCK_BUILD_ID,
  mockObservabilityServiceFactory,
} from "../test-utils/__mocks__";
import { observabilityService } from "@blocks-deployment/services/observability.service";
import { useProjectStore } from "@/modules/identifier/state/use-project-store";
import {
  useGetSASTData,
  useGetSCALibraryData,
  useSCARedirectLink,
  useSASTRedirectLink,
} from "./observability";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("@blocks-deployment/services/observability.service", () =>
  mockObservabilityServiceFactory(),
);
vi.mock("@/modules/identifier/state/use-project-store", () => ({
  useProjectStore: vi.fn(),
}));

describe("Observability Hooks", () => {
  beforeEach(() => {
    vi.mocked(useProjectStore).mockReturnValue({
      selectedProject: { tenantId: TEST_PROJECT_KEY },
    } as any);
  });

  // ─── useGetSASTData ─────────────────────────────────────────────────────────

  describe("useGetSASTData", () => {
    it("should fetch SAST data successfully", async () => {
      vi.mocked(observabilityService.SASTData).mockResolvedValue("sast-report");

      const { result } = renderHook(() => useGetSASTData(MOCK_BUILD_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("sast-report");
      expect(observabilityService.SASTData).toHaveBeenCalledWith(
        MOCK_BUILD_ID,
        TEST_PROJECT_KEY,
      );
    });
  });

  // ─── useGetSCALibraryData ──────────────────────────────────────────────────

  describe("useGetSCALibraryData", () => {
    it("should fetch SCA library data successfully", async () => {
      vi.mocked(observabilityService.SCAData).mockResolvedValue(
        "sca-library-report",
      );

      const { result } = renderHook(() => useGetSCALibraryData(MOCK_BUILD_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("sca-library-report");
      expect(observabilityService.SCAData).toHaveBeenCalledWith(
        MOCK_BUILD_ID,
        TEST_PROJECT_KEY,
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
        TEST_PROJECT_KEY,
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
});
