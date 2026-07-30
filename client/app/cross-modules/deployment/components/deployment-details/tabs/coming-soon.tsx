import React from "react";
import { Shield, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";

type ComingSoonProps = {
  buildId: string;
  cardData?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
};

const ComingSoonTab: React.FC<ComingSoonProps> = () => {
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
          <CardTitle className="text-2xl">Dynamic Application Security Testing</CardTitle>
          <CardDescription className="text-lg">Coming Soon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            We&apos;re working on bringing you comprehensive security analysis capabilities.
          </p>

          <div className="pt-4">
            <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              <Clock className="mr-1 h-3 w-3" />
              Feature in development
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoonTab;
