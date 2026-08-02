import { Button } from "@/components/ui-kits/button/button";
import { GitBranch } from "lucide-react";
import { useNavigate } from "react-router";
import { useProjectStore } from "@/store/project.store";

export const NoBranch = ({ projectEnvironment }: { projectEnvironment: string }) => {
  const navigate = useNavigate();
  const tenantGroupId = useProjectStore().selectedProject?.tenantGroupId || "";

  return (
    <div className="mx-auto pb-8">
      <div className="mt-2 space-y-2">
        <div className="flex h-auto flex-col items-center justify-center gap-6 self-stretch rounded-sm border border-border-default bg-background px-6 py-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <GitBranch className="h-8 w-8 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">No Repository available</h3>
              <p className="max-w-md text-sm text-gray-500">
                {`This project doesn't have any repository for ${projectEnvironment} environment yet.
                    Please create a repository with ${projectEnvironment} environment or select the proper environment from above.`}
              </p>
            </div>
            <Button
              onClick={() =>
                navigate(`/app/project/${tenantGroupId}/environments`)
              }
              size={"sm"}
            >
              Go to Deployment Overview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
