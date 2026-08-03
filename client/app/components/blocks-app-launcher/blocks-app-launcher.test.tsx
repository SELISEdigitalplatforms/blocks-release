import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { showErrorToast } from "@/hooks/use-toast";
import { BlocksAppLauncher } from "./blocks-app-launcher";

vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));

describe("BlocksAppLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, href: "" },
    });
  });

  it("opens the launcher and lists the default favourites", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<BlocksAppLauncher />);
    await user.click(screen.getByLabelText("SELISE Blocks apps"));
    expect(await screen.findByText("Your favourites")).toBeInTheDocument();
    // Default favourites are IAM and Localization.
    expect(screen.getByText("IAM")).toBeInTheDocument();
    expect(screen.getByText("Localization")).toBeInTheDocument();
    // Remaining apps appear under the "more" section.
    expect(screen.getByText("More from SELISE Blocks")).toBeInTheDocument();
  });

  it("toggles a favourite from the edit dialog and persists it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<BlocksAppLauncher />);
    await user.click(screen.getByLabelText("SELISE Blocks apps"));
    await user.click(screen.getByLabelText("Edit favourites"));
    expect(await screen.findByText("Manage Favourites")).toBeInTheDocument();
    // Toggle "Data" into favourites.
    const dataTile = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Data Integration"));
    fireEvent.click(dataTile as HTMLElement);
    const stored = JSON.parse(
      localStorage.getItem("blocks-app-favourites") || "[]",
    );
    expect(stored).toContain("data");
  });

  it("initiates login and redirects when a redirect uri is returned", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ redirect_uri: "https://idp/authorize" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<BlocksAppLauncher />);
    await user.click(screen.getByLabelText("SELISE Blocks apps"));
    fireEvent.click(await screen.findByText("IAM"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(window.location.href).toBe("https://idp/authorize"),
    );
    vi.unstubAllGlobals();
  });

  it("shows an error toast when the login initiation fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<BlocksAppLauncher />);
    await user.click(screen.getByLabelText("SELISE Blocks apps"));
    fireEvent.click(await screen.findByText("IAM"));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });
});
