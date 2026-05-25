/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DeploymentOverview from "@blocks-deployment/components/deployment-home/deployment-overview";
import { useGetAllProjects } from "@/cross-modules/deployment/hooks/use-github-info";
import LoadingSpinner from "@/components/loader-spinner/loader-spinner";
import { toast } from "@/hooks/use-toast";

const Deployment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [, setRefreshKey] = useState(0);

  useEffect(() => {
    if (searchParams.get("refresh")) {
      navigate("/deployment", { replace: true });
      setRefreshKey((prev) => prev + 1);
    }
  }, [searchParams, navigate]);

  const {
    data: apiProjects,
    isPending: loadingProjects,
    isError,
    error,
    refetch,
  } = useGetAllProjects({
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    forceRefresh: true,
  }) as any;

  useEffect(() => {
    refetch();
  }, [refetch]);

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
