import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { userService } from "./user.service";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("UserService", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockResolvedValue({ data: {} } as never);
  });

  it("getUser calls the iam me endpoint with an absolute url", async () => {
    await userService.getUser();
    const [url, , opts] = vi.mocked(http.get).mock.calls[0];
    expect(String(url)).toContain("/api/iam/me");
    expect(opts).toMatchObject({ absoluteUrl: true });
  });
});
