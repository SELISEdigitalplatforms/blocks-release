/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DeploymentOverview from "@blocks-deployment/components/deployment-home/deployment-overview";
import { useGetAllProjects } from "@blocks-deployment/hooks/github-info";
import { Loader } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/useProjectStore";

const Deployment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [, setRefreshKey] = useState(0);
  let projectId = "";
  const persistedData = localStorage.getItem("project-store");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  if (persistedData) {
    projectId = tenantId;
  }

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
  } = useGetAllProjects(projectId, {
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
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <DeploymentOverview projects={apiProjects?.data} refetch={refetch} />;
};

export default Deployment;
