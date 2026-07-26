import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { authService } from "@blocks-idp/authentication/services/auth.service";
import { useLogout } from "./use-auth";

vi.mock("@blocks-idp/authentication/services/auth.service", () => ({
  authService: { logout: vi.fn() },
}));

describe("useLogout", () => {
  it("calls authService.logout", async () => {
    vi.mocked(authService.logout).mockResolvedValue({} as never);
    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(),
    });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authService.logout).toHaveBeenCalled();
  });
});
