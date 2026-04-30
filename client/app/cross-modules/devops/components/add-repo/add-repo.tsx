import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import RequestForm from "./request-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { useEffect, useState } from "react";
import CallbackForm from "./callback-form";

type FormType = "request" | "callback";

type AlertProviderProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  itemId?: string;
  repoName: string;
  repoId: string;
  request?: boolean;
  externalServiceId?: string;
};

const AddSingleMonitor = ({
  open,
  onOpenChange,
  itemId,
  repoId,
  repoName,
  request,
  externalServiceId
}: AlertProviderProps) => {
  const [selectedForm, setSelectedForm] = useState<FormType>("request");

  useEffect(() => {
    setSelectedForm(request ? "request" : "callback");
  }, [request]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-screen-sm">
        <DialogHeader>
          <DialogTitle>{itemId ? "Configure monitor" : "Add single monitor"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-2">
          {/* Radio Group for Form Selection - Only show when adding new monitor */}
          {!itemId && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium">Monitor Type</label>
              <RadioGroup
                value={selectedForm}
                onValueChange={(value: FormType) => setSelectedForm(value)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="request" id="request" />
                  <label htmlFor="request">Request</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="callback" id="callback" />
                  <label htmlFor="callback">Callback</label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Conditional Form Rendering */}
          {selectedForm === "request" ? (
            <RequestForm
              itemId={itemId}
              onClose={() => onOpenChange(false)}
              repoId={repoId}
              repoName={repoName}
              externalServiceId={externalServiceId}
            />
          ) : (
            <CallbackForm
              itemId={itemId}
              repoId={repoId}
              repoName={repoName}
              externalServiceId={externalServiceId}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSingleMonitor;
