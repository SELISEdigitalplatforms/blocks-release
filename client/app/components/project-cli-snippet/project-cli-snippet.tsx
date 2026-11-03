import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { useT } from "@seliseblocks/genesis-os";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetProject } from "@blocks-identifier/hooks/use-project";
import { useProjectStore } from "@/store/project.store";
import { CopyableSnippet } from "@/components/copyable-snippet/copyable-snippet";
import { getProjectBlocksApiUrl } from "@/lib/domain";

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

export const ProjectCliSnippet = () => {
  const { t } = useT("release.shared");
  const { itemId } = useProjectStore().selectedProject || {
    itemId: "",
    tenantId: "",
  };
  const { data, isLoading } = useGetProject({ projectId: itemId });

  const cliSetupCommand = "npm install -g @seliseblocks/cli-os";
  const blocksMicroservicesUrl = getProjectBlocksApiUrl(data?.data);
  const projectSetupCommand =
    `blocks new web ${data?.data?.name?.replaceAll(" ", "_").toLowerCase()} --x-blocks-key ${data?.data?.tenantId} --app-domain ${data?.data?.applications?.[0]?.domain ?? ""} --project-slug ${data?.data?.tenantSlug || ""} --blocks-api-url ${blocksMicroservicesUrl}`.trim();

  if (isLoading) return <LoadingSkeleton />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("PROJECT_CLI_SNIPPET.FRONTEND_SETUP_COMMANDS")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          {t("PROJECT_CLI_SNIPPET.CLI_INSTALLED_HINT")}
          <CopyableSnippet code={projectSetupCommand} isCopyable={true} />
        </div>
        <div className="mt-6">
          {t("PROJECT_CLI_SNIPPET.CLI_NOT_INSTALLED_HINT")}
          <CopyableSnippet
            code={`${cliSetupCommand} \n${projectSetupCommand}`}
            isCopyable={true}
          />
        </div>
      </CardContent>
    </Card>
  );
};
