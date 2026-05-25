import React, { useCallback } from "react";
import { Loader2 } from "lucide-react";

export const useStatusIcon = () => {
  const getStatusIcon = useCallback((status: string): React.ReactNode => {
    switch (status) {
      case "Succeeded":
      case "success":
      case "Successful":
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-600">
            <span className="text-xs text-white">✓</span>
          </div>
        );
      case "error":
      case "Failed":
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600">
            <span className="text-xs text-white">✕</span>
          </div>
        );
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-600" />;
      case "pending":
        return (
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-400">
            <span className="text-xs text-white">○</span>
          </div>
        );
      default:
        return null;
    }
  }, []);

  return { getStatusIcon };
};
