import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { CircleHelp } from "lucide-react";

interface InfoTooltipProps {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function InfoTooltip({ content, side = "top" }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger type="button">
        <CircleHelp className="h-4 w-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-96 text-sm font-normal" side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
