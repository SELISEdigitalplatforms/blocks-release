import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { impersonationService } from "@blocks-idp/authentication/services/impersonation.service";
import {
  useImpersonationStatusChecker,
  useStartImpersonation,
  useStopImpersonation,
} from "./use-impersonation";
import type { ImpersonationRequest } from "../models/impersonate.model";

vi.mock("@blocks-idp/authentication/services/impersonation.service", () => ({
  impersonationService: {
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    impersonationStatus: vi.fn(),
  },
}));

describe("impersonation hooks", () => {
  it("useStartImpersonation calls the service", async () => {
    vi.mocked(impersonationService.startImpersonation).mockResolvedValue(
      {} as never,
    );
    const { result } = renderHook(() => useStartImpersonation(), {
      wrapper: createWrapper(),
    });
    const request = { userId: "u1" } as unknown as ImpersonationRequest;
    result.current.mutate(request);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(impersonationService.startImpersonation).toHaveBeenCalledWith(
      request,
    );
  });

  it("useStopImpersonation calls the service", async () => {
    vi.mocked(impersonationService.stopImpersonation).mockResolvedValue();
    const { result } = renderHook(() => useStopImpersonation(), {
      wrapper: createWrapper(),
    });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(impersonationService.stopImpersonation).toHaveBeenCalled();
  });

  it("useImpersonationStatusChecker queries the status", async () => {
    vi.mocked(impersonationService.impersonationStatus).mockResolvedValue({
      isImpersonating: false,
    } as never);
    const { result } = renderHook(() => useImpersonationStatusChecker(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(impersonationService.impersonationStatus).toHaveBeenCalled();
  });
});
