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
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "./public-guard";

export function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const { isMounted } = useAppState();
  const { data, isError } = useGetUser();
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMounted) return;
    if (!data || isError) return navigate(`/login`, { replace: true });
    setUser(data.data);
  }, [data, navigate, setUser]);
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
  if (isLoading || !isSuccess || !isInitialized) return null;
  return <>{children}</>;
};

export function ImpersonationTerminator({
  children,
}: {
  children: React.ReactNode;
}) {
  const { terminate, isImpersonated } = useImpersonateStore();
  const { mutateAsync } = useStopImpersonation();
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

  if (isImpersonated || isTriggering.current) return null;
  return <>{children}</>;
}

export function ImpersonationSynchronizer({
  children,
}: {
  children: React.ReactNode;
}) {
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
    const payload: ImpersonationRequest = {
      targetTenantId: selectedProject.tenantId,
    };
    mutateAsync(payload)
      .then(() => {
        impersonate(
          selectedProject.tenantId,
          getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"),
        );
        isTriggering.current = false;
      })
      .catch(() => {});
  }, [
    selectedProject?.tenantId,
    mutateAsync,
    impersonate,
    impersonatedTenantId,
    isTriggering,
  ]);
  if (!isImpersonated || isTriggering.current) return null;
  return <>{children}</>;
}
