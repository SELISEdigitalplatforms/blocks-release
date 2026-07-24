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

  it("shows a success toast and closes when the update succeeds", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true, message: "ok" });
    const onOpenChange = vi.fn();
    const { showSuccessToast } = await import("@/hooks/use-toast");
    render(
      <NotificationModal
        open
        onOpenChange={onOpenChange}
        request
        data={baseData}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses the health mutation when request is false", async () => {
    const healthMutate = vi.fn().mockResolvedValue({ isSuccess: true });
    vi.mocked(useUpdateHealth).mockReturnValue({
      mutateAsync: healthMutate,
    } as never);
    render(
      <NotificationModal
        open
        onOpenChange={vi.fn()}
        request={false}
        data={baseData}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(healthMutate).toHaveBeenCalled());
  });

  it("flags an invalid email and blocks saving", async () => {
    const { showErrorToast } = await import("@/hooks/use-toast");
    render(
      <NotificationModal
        open
        onOpenChange={vi.fn()}
        request
        data={{ ...baseData, emails: [""] }}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "not-an-email" } });
    expect(
      screen.getByText("Please enter a valid email address"),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("detects duplicate emails on save", () => {
    render(
      <NotificationModal
        open
        onOpenChange={vi.fn()}
        request
        data={{ ...baseData, emails: ["a@b.com"] }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[inputs.length - 1], {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(
      screen.getAllByText("This email is already added").length,
    ).toBeGreaterThan(0);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("removes an email row", () => {
    render(
      <NotificationModal
        open
        onOpenChange={vi.fn()}
        request
        data={{ ...baseData, emails: ["a@b.com", "c@d.com"] }}
      />,
    );
    expect(screen.getByDisplayValue("c@d.com")).toBeInTheDocument();
    const removeButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.text-error"));
    fireEvent.click(removeButtons[1]);
    expect(screen.queryByDisplayValue("c@d.com")).not.toBeInTheDocument();
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
