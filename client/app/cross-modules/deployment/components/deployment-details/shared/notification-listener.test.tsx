import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotificationListener, {
  DeploymentStatusBadge,
  useDeploymentStatus,
} from "./notification-listener";

const dispatchBuildNotification = (payload: object) => {
  const event = new CustomEvent("BuildLogNotification", {
    detail: { message: { denormalizedPayload: JSON.stringify(payload) } },
  });
  act(() => {
    window.dispatchEvent(event);
  });
};

describe("DeploymentStatusBadge", () => {
  it("renders the status text", () => {
    render(<DeploymentStatusBadge status="Succeeded" />);
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
  });
});

describe("NotificationListener", () => {
  it("renders the default status badge", () => {
    render(<NotificationListener deploymentStatus="Pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("useDeploymentStatus", () => {
  it("returns the initial deployment status", () => {
    const { result } = renderHook(() =>
      useDeploymentStatus({ itemId: "b1" }, "Running"),
    );
    expect(result.current).toBe("Running");
  });

  it("updates live when a matching build notification arrives", () => {
    const { result } = renderHook(() =>
      useDeploymentStatus({ itemId: "b1" }, "Running"),
    );
    dispatchBuildNotification({
      Message: { BuildId: "b1", EventType: "EventFinished" },
      RepoStatus: { BuildStatus: "Succeeded" },
    });
    expect(result.current).toBe("Succeeded");
  });

  it("ignores notifications for a different build", () => {
    const { result } = renderHook(() =>
      useDeploymentStatus({ itemId: "b1" }, "Running"),
    );
    dispatchBuildNotification({
      Message: { BuildId: "other" },
      RepoStatus: { BuildStatus: "Failed" },
    });
    expect(result.current).toBe("Running");
  });

  it("swallows malformed notification payloads", () => {
    const { result } = renderHook(() =>
      useDeploymentStatus({ itemId: "b1" }, "Running"),
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent("BuildLogNotification", {
          detail: { message: { denormalizedPayload: "not-json" } },
        }),
      );
    });
    expect(result.current).toBe("Running");
  });
});
