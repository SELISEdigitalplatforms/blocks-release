import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useGetUser } from "./use-user";

const setUser = vi.fn();

vi.mock("@/store/auth.store", () => ({
  useAuthStore: () => ({ setUser }),
}));

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: { getUser: vi.fn() },
}));

describe("useGetUser", () => {
  it("fetches the user and stores it", async () => {
    vi.mocked(userService.getUser).mockResolvedValue({
      data: { id: "u1" },
    } as never);
    const { result } = renderHook(() => useGetUser(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(userService.getUser).toHaveBeenCalled();
    expect(setUser).toHaveBeenCalledWith({ id: "u1" });
  });

  it("respects a disabled option", () => {
    const { result } = renderHook(() => useGetUser({ enabled: false }), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
