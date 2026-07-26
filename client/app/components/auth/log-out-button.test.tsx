import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogout } from "@blocks-idp/authentication/hooks/use-auth";

const resetProjectStore = vi.fn();
const setUnAuthenticated = vi.fn();
const clearTokens = vi.fn();
const resetSelectedLanguages = vi.fn();
const clear = vi.fn();

vi.mock("@blocks-idp/authentication/hooks/use-auth", () => ({
  useLogout: vi.fn(),
}));
vi.mock("@/providers/query-provider", () => ({
  getQueryClient: () => ({ clear }),
}));
vi.mock("@/store/auth.store", () => ({
  useAuthStore: () => ({ setUnAuthenticated, clearTokens }),
}));
vi.mock("@/store/project.store", () => ({
  useProjectStore: () => ({ resetProjectStore }),
}));
vi.mock("@/store/use-language-view.store", () => ({
  useLanguageViewStore: () => ({ resetSelectedLanguages }),
}));

import { LogOutButton } from "./log-out-button";

describe("LogOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "https://app.test",
        replace: vi.fn(),
      },
    });
  });

  it("logs out and clears all client state", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useLogout).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as never);
    render(<LogOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(resetProjectStore).toHaveBeenCalled();
    expect(setUnAuthenticated).toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalled();
    expect(resetSelectedLanguages).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
    expect(window.location.replace).toHaveBeenCalledWith(
      "https://app.test/login",
    );
  });

  it("disables the button while the logout is pending", () => {
    vi.mocked(useLogout).mockReturnValue({
      isPending: true,
      mutateAsync: vi.fn(),
    } as never);
    render(<LogOutButton />);
    expect(screen.getByRole("button", { name: "Logout" })).toBeDisabled();
  });
});
