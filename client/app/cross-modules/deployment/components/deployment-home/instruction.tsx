import { Button } from "@/components/ui-kits/button/button";
import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import ProviderButtons from "../deployment-steps/render-repos/render-provider";

const DeploymentInstruction = () => {
  const { t } = useT("release.deployment.home");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="font-dm-sans">
      <h1 className="mb-2 text-[24px] font-semibold leading-[32px] tracking-[-0.144px]">
        {t("INSTRUCTION.TITLE")}
      </h1>

      <p className="mb-6 text-base font-medium leading-6">
        {t("INSTRUCTION.INTRO")}
      </p>

      <div className="mb-6 space-y-1 text-base font-medium leading-6">
        <p className="mb-1">{t("INSTRUCTION.TO_GET_STARTED")}</p>
        <ol className="list-inside list-decimal space-y-1">
          <li>{t("INSTRUCTION.STEP_START")}</li>
          <li>{t("INSTRUCTION.STEP_CONNECT")}</li>
          <li>{t("INSTRUCTION.STEP_CONFIGURE")}</li>
          <li>{t("INSTRUCTION.STEP_BUILD")}</li>
          <li>{t("INSTRUCTION.STEP_DEPLOY")}</li>
        </ol>
      </div>

      <p className="mb-6 text-base font-medium leading-6">{t("INSTRUCTION.NEED_HELP")}</p>

      <Button onClick={() => setModalOpen(true)}>{t("INSTRUCTION.START_DEPLOYMENT")}</Button>

      {/* Dialog component */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[425px] p-6">
          <DialogHeader>
            <DialogTitle>{t("INSTRUCTION.CONNECT_TITLE")}</DialogTitle>
            <DialogDescription>
              {t("INSTRUCTION.CONNECT_DESCRIPTION")}
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons destination={"/app/deployment/configure"} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeploymentInstruction;
