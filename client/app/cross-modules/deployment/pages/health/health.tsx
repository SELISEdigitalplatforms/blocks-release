import { Card, CardContent } from "@/components/ui-kits/card/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { useProjectStore } from "@/store/useProjectStore";
import { TabKey, TABS } from "@blocks-deployment/constants/health.constant";
import { useGetHealthMonitorList } from "@blocks-deployment/hooks/alerts";
import { AlertsList } from "@blocks-deployment/pages/alert/alerts-list";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { useAlertFilterQueryParams } from "../alert/alerts-filter-toolbar";

const Health = () => {
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const [activeTab, setActiveTab] = useQueryState<TabKey>("tab", {
    defaultValue: "all",
    parse: (value: string) => {
      const validTabs: TabKey[] = ["all", "services", "deployed", "external"];
      return validTabs.includes(value as TabKey) ? (value as TabKey) : "all";
    },
  });

  const monitorSourceType = useMemo(
    () => TABS[activeTab].monitorSourceType,
    [activeTab],
  );
  const { queryParams, setQueryParams } = useAlertFilterQueryParams();
  const handlePageChange = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };

  const { data, isLoading } = useGetHealthMonitorList(
    projectKey,
    monitorSourceType,
    queryParams.page,
    queryParams.pageSize,
  );

  return (
    <main>
      <div className="mb-[18px] flex items-center justify-between md:mb-[24px]">
        <div className="flex items-center">
          {/* <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
          </Button> */}
          <h1 className="text-lg font-semibold md:text-2xl">Health</h1>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabKey)}>
        <div className="mb-5 mt-6 flex items-center justify-between rounded text-base">
          {/* Mobile Select */}
          <div className="md:hidden">
            <Select
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as TabKey)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TABS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden md:block">
            <TabsList>
              {Object.entries(TABS).map(([key, { label }]) => (
                <TabsTrigger key={key} value={key}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <Card>
          <CardContent>
            <AlertsList
              data={data?.data || []}
              isLoading={isLoading}
              pageNumber={queryParams.page}
              pageSize={queryParams.pageSize}
              onPageChange={handlePageChange}
              totalCount={data?.totalCount}
            />
          </CardContent>
        </Card>
      </Tabs>
    </main>
  );
};

export default Health;
