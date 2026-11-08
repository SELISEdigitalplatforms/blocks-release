import { MouseEventHandler } from "react";
import { Button } from "../ui-kits/button/button";
import { Settings } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

type ConfigureButtonProps = {
  onClick?: MouseEventHandler;
};

export const ConfigureButton = ({ onClick }: ConfigureButtonProps) => {
  const { t } = useT("release.shared");
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Settings className="h-5 w-5" />
      <span className="sr-only sm:not-sr-only sm:ml-2.5">
        {t("CONFIGURE_BUTTON.CONFIGURE")}
      </span>
    </Button>
  );
};
