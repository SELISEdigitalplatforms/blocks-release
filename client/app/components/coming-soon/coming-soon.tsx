import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui-kits/card/card";

interface ComingSoonPageProps {
  message: string;
}

const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ message }) => {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{message}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            We are working hard to bring something amazing!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoonPage;
