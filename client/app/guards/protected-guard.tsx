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
import { useEffect } from "react";
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
  const { terminate, isImpersonated, isTriggered, setTriggered } =
    useImpersonateStore();

  const { mutate } = useStopImpersonation();

  useEffect(() => {
    if (isTriggered || !isImpersonated) return;
    setTriggered(true);
    mutate(undefined, {
      onSuccess: () => {
        terminate(getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"));
        setTriggered(false);
      },
      onError: () => {
        // add logic if termination fails
        setTriggered(false);
      },
    });
  }, [mutate, terminate, isImpersonated]);

  if (isImpersonated || isTriggered) return null;

  return <>{children}</>;
}

export function ImpersonationSynchronizer({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    impersonate,
    isImpersonated,
    impersonatedTenantId,
    isTriggered,
    setTriggered,
  } = useImpersonateStore();
  const { mutate: startImpersonationMutate } = useStartImpersonation();

  const { selectedProject } = useProjectStore();

  useEffect(() => {
    if (!selectedProject?.tenantId) return;
    if (selectedProject.tenantId === impersonatedTenantId) return;
    if (isTriggered) return;

    setTriggered(true);
    const payload: ImpersonationRequest = {
      targetTenantId: selectedProject.tenantId,
    };

    startImpersonationMutate(payload, {
      onSuccess: () => {
        impersonate(
          payload.targetTenantId,
          getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"),
        );
        setTriggered(false);
      },
      onError: () => {
        // add logic if impersonation fails
        setTriggered(false);
      },
    });
  }, [
    selectedProject?.tenantId,
    startImpersonationMutate,
    impersonate,
    isTriggered,
    setTriggered,
    impersonatedTenantId,
  ]);

  if (!isImpersonated || isTriggered) return null;

  return <>{children}</>;
}
