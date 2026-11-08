import { ChevronLeft } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
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
  const { t } = useT("release.shared");
  return (
    <Button
      aria-label={t("BUTTONS.GO_BACK")}
      variant={"ghost"}
      size={"icon"}
      onClick={onClick}
      className={className}>
      {icon}
    </Button>
  );
}
