import ComingSoonPage from "@/components/coming-soon/coming-soon";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui-kits/tabs/tabs";
import { useGetMonitorListById } from "@/cross-modules/deployment/hooks/use-alerts";
import { useProjectStore } from "@/store/project.store";
import { useDeploymentStatus } from "@blocks-deployment/components/deployment-details/shared/notification-listener";
import { ALERT_PROVIDERS } from "@blocks-deployment/constants/alert.constant";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { AlertsList } from "./alerts-list";

const Alert = ({
  repoId,
  latestBuild,
  status,
  buildLength,
}: {
  repoId: string;
  latestBuild: unknown;
  status: string;
  buildLength: number;
}) => {
  const build = useDeploymentStatus(latestBuild, status);
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { data, isLoading } = useGetMonitorListById(projectKey, repoId);
  const [tabId, setTabId] = useState("health");

  const tabChangedHandler = (value: keyof typeof ALERT_PROVIDERS) => {
    setTabId(value);
  };

  return (
    <Card>
      <Tabs
        value={tabId}
        onValueChange={(value: string) =>
          tabChangedHandler(value as keyof typeof ALERT_PROVIDERS)
        }>
        <CardHeader>
          <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
            <span className="p-2 text-xl font-semibold leading-none">
              Monitoring
            </span>
            <div className="flex h-10 items-center justify-end gap-4 rounded text-base">
              <Button
                onClick={() =>
                  window.open(
                    "http://dev-observability.blocksdevelopers.com/health",
                    "_blank",
                  )
                }
                className="h-9 gap-2"
                disabled={
                  buildLength <= 0 ||
                  (build !== "Succeeded" && build !== "Failed")
                }>
                <ExternalLink className="h-4 w-4" />
                Manage Monitors
              </Button>
              <div className="flex items-center md:hidden">
                <Select
                  value={tabId}
                  onValueChange={(value: string) =>
                    tabChangedHandler(value as keyof typeof ALERT_PROVIDERS)
                  }>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="resources">Resources</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden h-9 items-center md:flex">
                <TabsList>
                  <TabsTrigger value="health" className="w-20">
                    Health
                  </TabsTrigger>
                  <TabsTrigger value="resources" className="w-20">
                    Resources
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
          </div>
        </CardHeader>
        {buildLength > 1 || build === "Succeeded" || build === "Failed" ? (
          <CardContent>
            <TabsContent value="health">
              <AlertsList data={data?.data || []} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="resources">
              <div className="h-[500px]">
                <ComingSoonPage message="Coming soon" />
              </div>
            </TabsContent>
          </CardContent>
        ) : (
          <div className="flex h-20 items-center justify-center">
            Please deploy your project to begin populating this section
          </div>
        )}
      </Tabs>
    </Card>
  );
};

export default Alert;
