import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImpersonationChecker,
  ImpersonationSynchronizer,
  ImpersonationTerminator,
  ProtectedGuard,
} from "./protected-guard";
import { PublicGuard, useAppState } from "./public-guard";
import { renderHook } from "@testing-library/react";
import { useAuthStore } from "@/store/auth.store";
import { useImpersonateStore } from "@/store/impersonate.store";
import { useProjectStore } from "@/store/project.store";
import { useGetUser } from "@blocks-idp/iam/hooks/use-user";
import {
  useImpersonationStatusChecker,
  useStartImpersonation,
  useStopImpersonation,
} from "@blocks-idp/authentication/hooks/use-impersonation";

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({ useGetUser: vi.fn() }));
vi.mock("@blocks-idp/authentication/hooks/use-impersonation", () => ({
  useImpersonationStatusChecker: vi.fn(),
  useStartImpersonation: vi.fn(),
  useStopImpersonation: vi.fn(),
}));

const renderInRouter = (ui: React.ReactElement, initial = "/app") =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path={initial} element={ui} />
        {initial !== "/login" && (
          <Route path="/login" element={<div>login page</div>} />
        )}
        {initial !== "/app/console" && (
          <Route path="/app/console" element={<div>console page</div>} />
        )}
      </Routes>
    </MemoryRouter>,
  );

describe("useAppState", () => {
  it("becomes mounted after the effect", async () => {
    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.isMounted).toBe(true));
  });
});

describe("ProtectedGuard", () => {
  it("renders children when the user is loaded", async () => {
    vi.mocked(useGetUser).mockReturnValue({
      data: { data: { id: "u1" } },
      isError: false,
    } as never);
    renderInRouter(
      <ProtectedGuard>
        <div>secret</div>
      </ProtectedGuard>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());
  });

  it("withholds children while there is no user", async () => {
    vi.mocked(useGetUser).mockReturnValue({
      data: undefined,
      isError: false,
    } as never);
    renderInRouter(
      <ProtectedGuard>
        <div>secret</div>
      </ProtectedGuard>,
    );
    // The guard renders null (no children) until a user is available.
    await waitFor(() =>
      expect(screen.queryByText("secret")).not.toBeInTheDocument(),
    );
  });
});

describe("PublicGuard", () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false });
  });

  it("renders children for an unauthenticated visitor", async () => {
    renderInRouter(
      <PublicGuard>
        <div>public</div>
      </PublicGuard>,
      "/login",
    );
    await waitFor(() => expect(screen.getByText("public")).toBeInTheDocument());
  });

  it("redirects authenticated users to the console", async () => {
    useAuthStore.setState({ isAuthenticated: true });
    renderInRouter(
      <PublicGuard>
        <div>public</div>
      </PublicGuard>,
      "/login",
    );
    await waitFor(() =>
      expect(screen.getByText("console page")).toBeInTheDocument(),
    );
  });
});

describe("ImpersonationChecker", () => {
  beforeEach(() => {
    useImpersonateStore.setState({ isInitialized: false, isImpersonated: false });
  });

  it("shows a loader while status is pending", () => {
    vi.mocked(useImpersonationStatusChecker).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
    } as never);
    renderInRouter(
      <ImpersonationChecker>
        <div>ready</div>
      </ImpersonationChecker>,
    );
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
  });

  it("renders children once status resolves", async () => {
    vi.mocked(useImpersonationStatusChecker).mockReturnValue({
      data: {
        impersonated: false,
        originalTenantId: "t1",
        impersonatedTenantId: null,
      },
      isLoading: false,
      isSuccess: true,
    } as never);
    renderInRouter(
      <ImpersonationChecker>
        <div>ready</div>
      </ImpersonationChecker>,
    );
    await waitFor(() => expect(screen.getByText("ready")).toBeInTheDocument());
  });
});

describe("ImpersonationTerminator", () => {
  it("renders children when not impersonating", () => {
    useImpersonateStore.setState({ isImpersonated: false });
    vi.mocked(useStopImpersonation).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
    } as never);
    renderInRouter(
      <ImpersonationTerminator>
        <div>done</div>
      </ImpersonationTerminator>,
    );
    expect(screen.getByText("done")).toBeInTheDocument();
  });

  it("terminates an active impersonation", async () => {
    useImpersonateStore.setState({ isImpersonated: true });
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useStopImpersonation).mockReturnValue({ mutateAsync } as never);
    renderInRouter(
      <ImpersonationTerminator>
        <div>done</div>
      </ImpersonationTerminator>,
    );
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });
});

describe("ImpersonationSynchronizer", () => {
  it("starts impersonation for the selected project", async () => {
    useImpersonateStore.setState({
      isImpersonated: false,
      impersonatedTenantId: null,
    });
    useProjectStore.setState({
      selectedProject: {
        itemId: "p",
        tenantId: "tenant-x",
      } as never,
    });
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useStartImpersonation).mockReturnValue({ mutateAsync } as never);
    renderInRouter(
      <ImpersonationSynchronizer>
        <div>synced</div>
      </ImpersonationSynchronizer>,
    );
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });
});
