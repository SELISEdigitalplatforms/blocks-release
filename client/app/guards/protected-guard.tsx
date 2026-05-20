import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { impersonationService } from "@blocks-idp/authentication/services/impersonation.service";
import { useAppState } from "./public-guard";
import { useGetUser } from "@/cross-modules/idp/iam/hooks/use-user";
import { useImpersonateStore } from "@/store/impersonate.store";
import { useProjectStore } from "@/store/project.store";
import { getRuntimeEnv } from "@/lib/runtime-env";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";

export function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const { isMounted } = useAppState();
  const {
    data: user,
    isLoading,
    isError,
  } = useGetUser({
    enabled: isMounted,
  });

  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMounted) return;
    if (isLoading) return;
    if (isError || !user) return navigate(`/login`, { replace: true });
    setUser(user.data);
  }, [user, isLoading, isError, navigate, setUser, isMounted]);
  if (!isMounted || isLoading || !user) return null;
  return <>{children}</>;
}

export function ImpersonateGuard({ children }: { children: React.ReactNode }) {
  const { startImpersonation, stopImpersonation } = useImpersonateStore();

  // Subscribe to the primitive tenantId only. The header (EnvironmentList)
  // re-syncs `selectedProject` from `useGetProject` once it mounts, which
  // changes the object identity on every refetch; keying off the primitive
  // means we only react to a real tenant switch.
  const selectedTenantId = useProjectStore(
    (state) => state.selectedProject?.tenantId,
  );

  const [ready, setReady] = useState(false);
  // `impersonatedTenantId`: tenant we've confirmed impersonation for.
  // `requestedTenantId`: tenant we've already kicked off a request for
  // (so we don't fire duplicates while it's in flight).
  const stateRef = useRef({
    impersonatedTenantId: null as string | null,
    requestedTenantId: null as string | null,
  });

  // Call the impersonation service directly. We deliberately bypass
  // react-query's useMutation here: under StrictMode its observer is torn
  // down/recreated and the per-call promise resolution gets lost, leaving
  // the guard stuck on "pending" forever (the bug we hit).
  useEffect(() => {
    if (!selectedTenantId) return;
    if (stateRef.current.impersonatedTenantId === selectedTenantId) return;
    if (stateRef.current.requestedTenantId === selectedTenantId) return;
    stateRef.current.requestedTenantId = selectedTenantId;

    const target = selectedTenantId;
    console.debug("[ImpersonateGuard] calling impersonate ->", target);

    // NOTE: no `cancelled` flag here on purpose. Under React StrictMode the
    // effect runs setup → cleanup → setup; a cleanup-set `cancelled` would
    // discard the (already in-flight) resolution and `setReady` would never
    // fire. The `requestedTenantId` ref persists across StrictMode and
    // prevents duplicate network calls, so it's safe to always apply.
    impersonationService
      .startImpersonation({ targetTenantId: target })
      .then((res) => {
        console.debug("[ImpersonateGuard] impersonate RESOLVED", res);
        startImpersonation(target, getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"));
        stateRef.current.impersonatedTenantId = target;
        // Only the FIRST impersonation gates rendering. Subsequent tenant
        // switches keep the subtree mounted so queries are not cancelled.
        setReady(true);
      })
      .catch((err) => {
        console.error("[ImpersonateGuard] impersonate REJECTED", err);
        // allow a retry of the same tenant
        if (stateRef.current.requestedTenantId === target) {
          stateRef.current.requestedTenantId = null;
        }
      });
  }, [selectedTenantId, startImpersonation]);

  // Stop impersonation only when the guard actually unmounts.
  useEffect(() => {
    return () => {
      if (!stateRef.current.impersonatedTenantId) return;
      stateRef.current.impersonatedTenantId = null;
      stateRef.current.requestedTenantId = null;
      // TEMP (debugging): do NOT call server-side stop-impersonation on unmount.
      // It deletes the auth/impersonation cookies and masks the underlying 401.
      // Re-enable once the 401 root cause is found.
      // impersonationService
      //   .stopImpersonation()
      //   .then(() => stopImpersonation())
      //   .catch((err) =>
      //     console.error("[ImpersonateGuard] stopImpersonation failed", err),
      //   );
    };
  }, [stopImpersonation]);

  if (!ready) {
    return (
      <LoadingSpinner variant="overlay" label="Preparing your workspace…" />
    );
  }

  return <>{children}</>;
}
