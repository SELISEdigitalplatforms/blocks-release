import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Bell } from "lucide-react";

export function Notification() {
  return (
     <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-all hover:border-input hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-primary">Notifications</div>
          <div className="text-sm text-muted-foreground">
            Real-time notifications are being ported into the standalone client.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
