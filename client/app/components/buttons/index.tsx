import { ChevronLeft } from "lucide-react";
import { Button } from "../ui-kits/button/button";

type BackIconButtonProps = {
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
};

export function BackIconButton({
  icon = <ChevronLeft size={20} />,
  onClick,
  className,
}: BackIconButtonProps) {
  return (
    <Button
      aria-label="Go back"
      variant={"ghost"}
      size={"icon"}
      onClick={onClick}
      className={className}>
      {icon}
    </Button>
  );
}
