import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { X } from "lucide-react";
import { DialogProps } from "@radix-ui/react-dialog";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<
  DialogProps & {
    itemId: string | null;
  }
>;

export function MonitorModal({ itemId, open, onOpenChange, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-screen-sm" hideCloseButton>
        <DialogHeader className="relative pr-8">
          <DialogTitle>{itemId ? "Configure" : "Add monitor"}</DialogTitle>
          <DialogClose
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="absolute right-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
