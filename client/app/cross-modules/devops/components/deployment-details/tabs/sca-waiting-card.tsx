import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { Clock, Shield, Container } from "lucide-react";

interface ContainerWaitingProps {
  type?: "overall" | "container";
}

const ContainerWaiting = ({ type = "container" }: ContainerWaitingProps) => {
  if (type === "overall") {
    return (
      <div className="w-full">
        <Card className="w-full">
          <CardHeader className="pb-4 text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Shield className="h-16 w-16 text-muted-foreground" />
                <Clock className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Software Composition Analysis</CardTitle>
            <CardDescription className="text-lg">Data Processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              The Software Composition Analysis data is still being processed. Please check back
              later.
            </p>

            <div className="pt-4">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                <Clock className="mr-1 h-3 w-3" />
                Analysis in progress
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
          <CardTitle className="text-2xl">Container Image Scan</CardTitle>
          <CardDescription className="text-lg">Waiting for Build Completion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Container image scan data will be available once the build process is complete. Please
            wait for the build to finish.
          </p>

          <div className="pt-4">
            <div className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <Clock className="mr-1 h-3 w-3" />
              Waiting for build completion
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContainerWaiting;
