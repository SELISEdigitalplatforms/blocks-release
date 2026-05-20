import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { GitBranch, Plus } from "lucide-react";

export const NoRepositoryAvailable = () => {
  return (
    <Card>
      <div className="flex h-auto flex-col items-center justify-center self-stretch rounded-sm bg-background px-1 py-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <GitBranch className="h-8 w-8 text-low-emphasis" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="py-4 text-xl font-semibold text-high-emphasis">
            No repository added
          </h3>

          <p className="max-w-md items-center text-center text-sm text-medium-emphasis">
            To view deployment activity, please add at least one repository to
            your project
          </p>
        </div>
        <Button
          onClick={() =>
            window.open(
              `${getRuntimeEnv("BLOCKS_OS_URL")}/project-overview/repositories`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          size={"sm"}
          className="mt-6">
          <Plus size={16} /> Add repository
        </Button>
      </div>
    </Card>
  );
};
