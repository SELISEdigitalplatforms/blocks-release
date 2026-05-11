import { Button } from "@/components/ui-kits/button/button";
import { GitBranch } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const NoDeploymentAvailable = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto pb-8">
      <div className="mt-2 space-y-2">
        <div className="flex h-auto flex-col items-center justify-center gap-6 self-stretch rounded-sm border border-border-default bg-background px-6 py-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <GitBranch className="h-8 w-8 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">No deployments available</h3>
              <p className="max-w-md text-sm text-gray-500">
                This repository has not been deployed yet. Click the deploy button to create your
                first deployment.
              </p>
            </div>
            <Button onClick={() => navigate("/project-overview")} size={"sm"}>
              Go to project overview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
