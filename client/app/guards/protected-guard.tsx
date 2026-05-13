import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import {
  useStartImpersonation,
  useStopImpersonation,
} from "@/cross-modules/identifier/hooks/use-impersonation";
import { useAppState } from "./public-guard";
import { useGetUser } from "@/cross-modules/idp/iam/hooks/use-user";
import { useImpersonateStore } from "@/store/impersonate.store";
import { useProjectStore } from "@/store/project.store";
import { ImpersonationRequest } from "@/cross-modules/identifier/services/impersonation.service";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { useGetProjects } from "@/cross-modules/identifier/hooks/use-project";

export function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const { isMounted } = useAppState();
  const {
    data: user,
    isLoading,
    isError,
  } = useGetUser({
    enabled: isMounted,
  });
  const { data: _projects } = useGetProjects({ enabled: !!user });

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
  const { mutate: startImpersonationMutate } = useStartImpersonation();
  const { mutate: stopImpersonationMutate } = useStopImpersonation();

  const { selectedProject } = useProjectStore();

  const [ready, setReady] = useState(false);
  const impersonateRef = useRef({
    hasStarted: false,
    isCompleted: false,
  });

  useEffect(() => {
    if (!selectedProject?.tenantId) return;
    if (impersonateRef.current.hasStarted) return;
    impersonateRef.current.hasStarted = true;

    const payload: ImpersonationRequest = {
      targetTenantId: selectedProject.tenantId,
    };

    startImpersonationMutate(payload, {
      onSuccess: () => {
        startImpersonation(
          payload.targetTenantId,
          getRuntimeEnv("BLOCKS_X_BLOCKS_KEY"),
        );

        impersonateRef.current.isCompleted = true;
        setReady(true);
      },
      onError: () => {
        impersonateRef.current.hasStarted = false;
      },
    });

    return () => {
      if (!impersonateRef.current.isCompleted) return;

      stopImpersonationMutate(undefined, {
        onSuccess: () => {
          stopImpersonation();
          impersonateRef.current.hasStarted = false;
          impersonateRef.current.isCompleted = false;

          setReady(false);
        },
      });
    };
  }, [
    selectedProject?.tenantId,
    startImpersonationMutate,
    stopImpersonationMutate,
    startImpersonation,
    stopImpersonation,
  ]);

  if (!ready) return null;

  return <>{children}</>;
}
