import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { useGetAllIncidentList } from "@blocks-devops/hooks/alerts";
import { useParams, useNavigate } from "react-router-dom";
import IncidentList, { useAlertFilterQueryParams } from "./incident-list";
import { Button } from "@/components/ui-kits/button/button";
import { ArrowLeft } from "lucide-react";
import { LoadingSkelton } from "./alerts-list";

const IncidentPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const monitorId = params.id as string;

  const { queryParams, setQueryParams } = useAlertFilterQueryParams();

  const { data, isLoading } = useGetAllIncidentList(
    monitorId,
    queryParams.page,
    queryParams.pageSize,
  );
  const handlePageChange = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };
  if (isLoading) {
    return <LoadingSkelton />;
  }
  return (
    <main>
      {/* <PageBreadcrumb breadcrumbIndex={2} /> */}
      <div className="hidden md:flex"></div>
      <div className="mb-[18px] md:mb-[20px]">
        <div className="flex items-center">
          {" "}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <span className="text-lg font-semibold md:text-2xl">Incidents</span>
        </div>
      </div>
      <Card className="h-full">
        <CardHeader></CardHeader>
        <CardContent>
          <IncidentList
            data={data?.data || []}
            pageSize={queryParams.pageSize}
            totalCount={data?.totalCount}
            pageNumber={queryParams.page}
            onPageChange={handlePageChange}
          />{" "}
        </CardContent>
      </Card>
    </main>
  );
};
export default IncidentPage;
