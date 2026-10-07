/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useEffectEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import DeploymentOverview from "@blocks-deployment/components/deployment-home/deployment-overview";
import { useGetAllProjects } from "@/cross-modules/deployment/hooks/use-github-info";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/project.store";
import { useScopedPath } from "@/hooks/use-scoped-path";

const Deployment = () => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [searchParams] = useSearchParams();
  const projectKey = useProjectStore((s) => s.selectedProject?.tenantId) ?? "";

  // `scoped` is a fresh function every render; an effect event reads it without making it a
  // dependency, so the effect still fires only when the search params (or navigate) change.
  const scopedPath = useEffectEvent((sub: string) => scoped(sub));

  // Clearing ?refresh from the URL re-renders this page through the router, so no extra
  // state bump is needed to pick up the refreshed list.
  useEffect(() => {
    if (searchParams.get("refresh")) {
      navigate(scopedPath("deployment"), { replace: true });
    }
  }, [searchParams, navigate]);

  const {
    data: apiProjects,
    isPending: loadingProjects,
    isError,
    error,
    refetch,
  } = useGetAllProjects(
    {
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      forceRefresh: true,
    },
    projectKey,
  ) as any;

  if (isError && error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: error?.errors?.Message,
      duration: 3000,
    });
  }

  if (loadingProjects) {
    return <LoadingSpinner variant="overlay" label="Loading..." />;
  }

  return <DeploymentOverview projects={apiProjects?.data} refetch={refetch} />;
};

export default Deployment;
