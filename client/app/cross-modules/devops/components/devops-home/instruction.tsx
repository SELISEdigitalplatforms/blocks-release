import { Button } from "@/components/ui-kits/button/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import ProviderButtons from "../deployment-steps/render-repos/render-provider";

const DeploymentInstruction = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="font-dm-sans">
      <h1 className="mb-2 text-[24px] font-semibold leading-[32px] tracking-[-0.144px]">
        Deployment
      </h1>

      <p className="mb-6 text-base font-medium leading-6">
        Connect your repository and let Blocks Cloud handle the rest — from build to deployment.
      </p>

      <div className="mb-6 space-y-1 text-base font-medium leading-6">
        <p className="mb-1">To get started:</p>
        <ol className="list-inside list-decimal space-y-1">
          <li>Click Start Deployment</li>
          <li>Connect your GitHub account and select your repository</li>
          <li>Configure your build settings</li>
          <li>Hit Build to start the process</li>
          <li>
            Once the build succeeds, click Deploy to publish your app to your configured domain
          </li>
        </ol>
      </div>

      <p className="mb-6 text-base font-medium leading-6">Need help? </p>

      <Button onClick={() => setModalOpen(true)}>Start deployment</Button>

      {/* Dialog component */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[425px] p-6">
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>
              Select a Git provider to import an existing project from a Git Repository.
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons destination={"/devops/configure"} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeploymentInstruction;
