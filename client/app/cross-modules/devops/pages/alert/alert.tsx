import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui-kits/tabs/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";

import { ALERT_PROVIDERS } from "@blocks-devops/constants/alert.constant";
import { useState } from "react";
import { Plus } from "lucide-react";
import ComingSoonPage from "@/components/coming-soon/coming-soon";
import AddSingleMonitor from "@blocks-devops/components/add-repo/add-repo";
import { useProjectStore } from "@/store/useProjectStore";
import { useGetMonitorListById } from "@blocks-devops/hooks/alerts";
import { AlertsList } from "./alerts-list";
import { Button } from "@/components/ui-kits/button/button";
import { useDeploymentStatus } from "@blocks-devops/components/deployment-details/shared/notification-listener";

const Alert = ({
  repoName,
  repoId,
  latestBuild,
  status,
  buildLength,
}: {
  repoName: string;
  repoId: string;
  latestBuild: any;
  status: string;
  buildLength: number;
}) => {
  const build = useDeploymentStatus(latestBuild, status);
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { data, isLoading } = useGetMonitorListById(projectKey, repoId);
  const [tabId, setTabId] = useState("health");
  const [open, setOpen] = useState(false);

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
            <span className="p-2 text-xl font-semibold">Monitoring</span>
            <div className="flex items-center justify-end gap-4 rounded text-base">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  onClick={() => setOpen((open) => !open)}
                  variant={"outline"}
                  className="h-9"
                  disabled={
                    buildLength <= 0 ||
                    (build !== "Succeeded" && build !== "Failed")
                  }>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="md:hidden">
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
              <div className="hidden h-9 md:block">
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
            <AddSingleMonitor
              open={open}
              onOpenChange={setOpen}
              repoName={repoName}
              repoId={repoId}
              request={true}
            />
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
