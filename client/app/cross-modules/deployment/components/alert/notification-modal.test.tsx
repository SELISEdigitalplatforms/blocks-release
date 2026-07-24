import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useUpdateHealth,
  useUpdateSingleMonitor,
} from "@/cross-modules/deployment/hooks/use-alerts";

vi.mock("@/cross-modules/deployment/hooks/use-alerts", () => ({
  useUpdateSingleMonitor: vi.fn(),
  useUpdateHealth: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

import NotificationModal from "./notification-modal";

const baseData = {
  itemId: "m1",
  name: "Monitor 1",
  isActive: true,
  emails: ["a@b.com"],
  repoId: "r1",
  projectKey: "pk",
};

describe("NotificationModal", () => {
  const mutateAsync = vi.fn().mockResolvedValue({ data: {} });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateSingleMonitor).mockReturnValue({ mutateAsync } as never);
    vi.mocked(useUpdateHealth).mockReturnValue({ mutateAsync } as never);
  });

  it("renders the existing emails when open", () => {
    render(
      <NotificationModal
        open
        onOpenChange={vi.fn()}
        request
        data={baseData}
      />,
    );
    expect(screen.getByDisplayValue("a@b.com")).toBeInTheDocument();
  });

  it("adds, edits and removes an email", () => {
    render(
      <NotificationModal
        open
        onOpenChange={vi.fn()}
        request
        data={baseData}
      />,
    );
    // Add a new email row.
    const addButton = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addButton);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[inputs.length - 1], {
      target: { value: "c@d.com" },
    });
    expect(screen.getByDisplayValue("c@d.com")).toBeInTheDocument();
  });

  it("saves valid emails through the monitor mutation", async () => {
    const onOpenChange = vi.fn();
    render(
      <NotificationModal
        open
        onOpenChange={onOpenChange}
        request
        data={baseData}
      />,
    );
    const save = screen.getByRole("button", { name: /save/i });
    fireEvent.click(save);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });

  it("closes on cancel", () => {
    const onOpenChange = vi.fn();
    render(
      <NotificationModal
        open
        onOpenChange={onOpenChange}
        request={false}
        data={baseData}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
