import {
  useImpersonationStatusChecker,
  useStartImpersonation,
  useStopImpersonation,
} from "@blocks-idp/authentication/hooks/use-impersonation";
import { ImpersonationRequest } from "@blocks-idp/authentication/models/impersonate.model";
import { useGetUser } from "@blocks-idp/iam/hooks/use-user";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useAuthStore } from "@/store/auth.store";
import { useImpersonateStore } from "@/store/impersonate.store";
import { useProjectStore } from "@/store/project.store";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppState } from "./public-guard";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";

export function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const { isMounted } = useAppState();
  const { data, isError } = useGetUser();
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  // Read through an effect event so `isMounted` gates the effect without retriggering it:
  // the mount-time run is skipped, and the effect fires again only when the user query
  // (or navigate/setUser) changes - so a still-loading user is never sent to /login.
  const hasMounted = useEffectEvent(() => isMounted);

  useEffect(() => {
    if (!hasMounted()) return;
    if (!data || isError) {
      navigate(`/login`, { replace: true });
      return;
    }
    setUser(data.data);
  }, [data, navigate, setUser, isError]);

  if (!isMounted || !data) return null;
  return <>{children}</>;
}

export const ImpersonationChecker = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { data, isLoading, isSuccess } = useImpersonationStatusChecker();
  const { setImpersonation, isInitialized, setInitialized } =
    useImpersonateStore();

  useEffect(() => {
    if (!data) return;
    setImpersonation(
      data.impersonated,
      data.originalTenantId,
      data.impersonated ? data.impersonatedTenantId : null,
    );
    setInitialized(true);
  }, [data, setImpersonation, setInitialized]);
  if (isLoading || !isSuccess || !isInitialized) return <LoadingSpinner />;
  return <>{children}</>;
};

export function ImpersonationTerminator({
  children,
}: {
  children: React.ReactNode;
}) {
  const { terminate, isImpersonated } = useImpersonateStore();
  const { mutateAsync, isPending } = useStopImpersonation();
  const isTriggering = useRef(false);

  useEffect(() => {
    if (isTriggering.current || !isImpersonated) return;
    isTriggering.current = true;
    mutateAsync(undefined)
      .then(() => {
        terminate(getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"));
        isTriggering.current = false;
      })
      .catch(() => {
        isTriggering.current = false;
      });
  }, [mutateAsync, terminate, isImpersonated, isTriggering]);

  // The ref only de-duplicates the request inside the effect; the render reads the
  // mutation's own pending state, which spans the same request.
  if (isImpersonated || isPending) return null;
  return <>{children}</>;
}

export function ImpersonationSynchronizer({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isImpersonating, setIsImpersonating] = useState(false);

  const { impersonate, isImpersonated, impersonatedTenantId } =
    useImpersonateStore();
  const { mutateAsync } = useStartImpersonation();

  const { selectedProject } = useProjectStore();
  const isTriggering = useRef(false);

  useEffect(() => {
    if (!selectedProject?.tenantId) return;
    if (selectedProject.tenantId === impersonatedTenantId) return;
    if (isTriggering.current) return;

    isTriggering.current = true;
    setIsImpersonating(true);

    const payload: ImpersonationRequest = {
      targeted_tenant_id: selectedProject.tenantId,
    };
    mutateAsync(payload)
      .then(() => {
        impersonate(
          selectedProject.tenantId,
          getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"),
        );
        isTriggering.current = false;
        setIsImpersonating(false);
      })
      .catch(() => {
        isTriggering.current = false;
        setIsImpersonating(false);
      });
  }, [
    selectedProject?.tenantId,
    mutateAsync,
    impersonate,
    impersonatedTenantId,
    isTriggering,
  ]);
  // `isImpersonating` is set and cleared alongside the ref, so while a request is in flight
  // the spinner above has already returned; the ref is only needed inside the effect.
  if (isImpersonating) return <LoadingSpinner />;

  if (!isImpersonated) return null;
  return <>{children}</>;
}
