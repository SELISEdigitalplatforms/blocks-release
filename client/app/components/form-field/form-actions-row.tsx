import { Button } from "@/components/ui-kits/button/button";
import { DialogClose } from "@radix-ui/react-dialog";

type FormActionsRowProps = {
  cancelLabel: string;
  saveLabel: string;
  isSaveDisabled: boolean;
};

export const FormActionsRow = ({
  cancelLabel,
  saveLabel,
  isSaveDisabled,
}: FormActionsRowProps) => {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <DialogClose asChild>
        <Button type="button" variant="outline">
          {cancelLabel}
        </Button>
      </DialogClose>

      <Button type="submit" disabled={isSaveDisabled}>
        {saveLabel}
      </Button>
    </div>
  );
};
