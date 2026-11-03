import { Link } from "react-router";
import { Plus } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { useProjectStore } from "@/store/project.store";
import { useGetProject } from "@blocks-identifier/hooks/use-project";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Button } from "@/components/ui-kits/button/button";
import { CopyableSnippet } from "@/components/copyable-snippet/copyable-snippet";

const LoadingSkeleton = () => (
  <Card>
    <CardContent>
      <div>
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="mt-2 h-6 w-full" />
      </div>
      <div className="mt-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="mt-2 h-6 w-full" />
      </div>
    </CardContent>
  </Card>
);

export const GitCommandSnippet = () => {
  const { t } = useT("release.shared");
  const { itemId } = useProjectStore().selectedProject || {
    itemId: "",
    tenantId: "",
  };
  const { data, isLoading } = useGetProject({ projectId: itemId });

  if (isLoading) return <LoadingSkeleton />;
  const branchName =
    data?.data?.environment === "prod" ? "main" : data?.data?.environment;
  const repoLink = "<your-repo-link>";
  const hasRepository = false;
  const gitCommands = `git remote add origin ${repoLink}\ngit branch -M ${branchName}\ngit add .\ngit commit -m "feat: initiate project"\ngit push -u origin ${branchName}`;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("GIT_COMMAND_SNIPPET.GIT_COMMANDS")}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRepository && (
          <div className="flex flex-col items-center justify-between gap-3 rounded-sm border border-base-error bg-blocks-error-100 px-4 py-4 text-base font-normal text-blocks-error-800 md:flex-row md:gap-4">
            <p>
              {t("GIT_COMMAND_SNIPPET.ADD_REPOSITORY_HINT")}
            </p>
            <Link to="/app/deployment">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("GIT_COMMAND_SNIPPET.ADD_REPOSITORY")}
              </Button>
            </Link>
          </div>
        )}
        <div
          className={
            !hasRepository
              ? "pointer-events-none mt-4 select-none opacity-50"
              : ""
          }
        >
          <CopyableSnippet code={gitCommands} isCopyable={hasRepository} />
        </div>
      </CardContent>
    </Card>
  );
};
