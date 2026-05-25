import React from "react";
import { Loader } from "lucide-react";

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  variant?: "fullscreen" | "overlay" | "inline";
  label?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 32,
  color = "text-primary",
  variant = "overlay",
  label = "Loading...",
}) => {
  const containerClasses = {
    fullscreen:
      "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
    overlay:
      "absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm",
    inline: "flex items-center justify-center p-4",
  };

  return (
    <div className={containerClasses[variant]}>
      <div className="flex flex-col items-center space-y-4">
        <div className="flex animate-pulse">
          <Loader size={size} className={`animate-spin ${color}`} />
        </div>
        {label && (
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
