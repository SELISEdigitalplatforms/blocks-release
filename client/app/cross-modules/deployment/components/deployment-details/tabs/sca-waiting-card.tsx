import { useT } from "@seliseblocks/genesis-os";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { AlertTriangle, Clock, Shield, Container } from "lucide-react";
import type React from "react";

interface ContainerWaitingProps {
  type?: "overall" | "container";
}

const ContainerWaiting = ({ type = "container" }: ContainerWaitingProps) => {
  const { t } = useT("release.deployment.scans");
  if (type === "overall") {
    return (
      <div className="w-full">
        <Card className="w-full" role="status">
          <CardHeader className="pb-4 text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Shield className="h-16 w-16 text-muted-foreground" />
                <Clock className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">{t("SCA_WAITING_CARD.OVERALL_TITLE")}</CardTitle>
            <CardDescription className="text-lg">{t("SCA_WAITING_CARD.OVERALL_SUBTITLE")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              {t("SCA_WAITING_CARD.OVERALL_DESCRIPTION")}
            </p>

            <div className="pt-4">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                <Clock className="mr-1 h-3 w-3" />
                {t("SCA_WAITING_CARD.OVERALL_BADGE")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Card className="w-full">
        <CardHeader className="pb-4 text-center">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <Container className="h-16 w-16 text-muted-foreground" />
              <Clock className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t("SCA_WAITING_CARD.CONTAINER_TITLE")}</CardTitle>
          <CardDescription className="text-lg">{t("SCA_WAITING_CARD.CONTAINER_SUBTITLE")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            {t("SCA_WAITING_CARD.CONTAINER_DESCRIPTION")}
          </p>

          <div className="pt-4">
            <div className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <Clock className="mr-1 h-3 w-3" />
              {t("SCA_WAITING_CARD.CONTAINER_BADGE")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface ReportUnavailableCardProps {
  title: string;
  status: "NotRun" | "Failed";
  message?: string | null;
  /** The tab's existing button to the tool (SonarQube / Dependency-Track). */
  action: React.ReactNode;
}

/** A saved report that holds no results: the scan step did not run, or capture failed. */
export const ReportUnavailableCard = ({
  title,
  status,
  message,
  action,
}: ReportUnavailableCardProps) => {
  const { t } = useT("release.deployment.scans");
  return (
  <Card className="w-full">
    <CardHeader className="pb-4 text-center">
      <div className="mb-4 flex justify-center">
        <div className="relative">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <AlertTriangle
            data-testid="report-unavailable-icon"
            className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 ${
              status === "NotRun" ? "text-amber-600" : "text-red-600"
            }`}
          />
        </div>
      </div>
      <CardTitle className="text-2xl">{title}</CardTitle>
      <CardDescription className="text-lg">
        {status === "NotRun"
          ? t("SCA_WAITING_CARD.REPORT_NOT_RUN")
          : t("SCA_WAITING_CARD.REPORT_NOT_CAPTURED")}
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 text-center">
      {message && <p className="text-muted-foreground">{message}</p>}
      <div className="flex justify-center">{action}</div>
    </CardContent>
  </Card>
  );
};

export default ContainerWaiting;
