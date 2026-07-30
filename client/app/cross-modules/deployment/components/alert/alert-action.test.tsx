import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import {
  useDeleteHealth,
  useDeleteMonitor,
  useUpdateHealth,
  useUpdateSingleMonitor,
} from "@/cross-modules/deployment/hooks/use-alerts";

vi.mock("@/cross-modules/deployment/hooks/use-alerts", () => ({
  useUpdateSingleMonitor: vi.fn(),
  useUpdateHealth: vi.fn(),
  useDeleteMonitor: vi.fn(),
  useDeleteHealth: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

import AlertAction from "./alert-action";

const props = {
  monitorId: "m1",
  isActive: true,
  name: "Monitor 1",
  request: true,
  projectKey: "pk",
  monitorSourceType: 1,
};

describe("AlertAction", () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  const pending = { mutateAsync, isPending: false } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateSingleMonitor).mockReturnValue(pending);
    vi.mocked(useUpdateHealth).mockReturnValue(pending);
    vi.mocked(useDeleteMonitor).mockReturnValue(pending);
    vi.mocked(useDeleteHealth).mockReturnValue(pending);
  });

  it("opens the menu and confirms a pause", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<AlertAction {...props} />);
    await user.click(document.querySelector("svg.lucide-ellipsis-vertical")!);
    const pause = await screen.findByText("Pause");
    await user.click(pause);
    const confirm = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirm);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });

  it("uses the health mutation and toasts on success when request is false", async () => {
    const healthMutate = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateHealth).mockReturnValue({
      mutateAsync: healthMutate,
      isPending: false,
    } as never);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<AlertAction {...props} request={false} />);
    await user.click(document.querySelector("svg.lucide-ellipsis-vertical")!);
    await user.click(await screen.findByText("Pause"));
    await user.click(await screen.findByRole("button", { name: /confirm/i }));
    const { toast } = await import("@/hooks/use-toast");
    await waitFor(() => expect(healthMutate).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("toasts a failure when the update mutation throws", async () => {
    vi.mocked(useUpdateSingleMonitor).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("boom")),
      isPending: false,
    } as never);
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<AlertAction {...props} />);
    await user.click(document.querySelector("svg.lucide-ellipsis-vertical")!);
    await user.click(await screen.findByText("Pause"));
    await user.click(await screen.findByRole("button", { name: /confirm/i }));
    const { toast } = await import("@/hooks/use-toast");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("opens the delete dialog and confirms deletion", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderWithProviders(<AlertAction {...props} />);
    await user.click(document.querySelector("svg.lucide-ellipsis-vertical")!);
    const del = await screen.findByText("Delete");
    await user.click(del);
    const confirm = await screen.findByRole("button", { name: /confirm/i });
    await user.click(confirm);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });
});
