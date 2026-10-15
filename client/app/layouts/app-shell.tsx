import type { ReactNode } from "react";
import { AppShell as SharedAppShell } from "@seliseblocks/app-kit";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/components/command-palette/command-palette-provider";
import { useReleaseNavigation } from "@/hooks/use-release-navigation";

type AppShellProps = { children: ReactNode; sidebar?: boolean };

function ReleaseShell(props: AppShellProps) {
  const sections = useReleaseNavigation();
  const openPalette = useCommandPalette();
  return <SharedAppShell {...props} sections={sections} onOpenCommand={() => openPalette(true)} />;
}

export function AppShell(props: AppShellProps) {
  return (
    <CommandPaletteProvider>
      <ReleaseShell {...props} />
    </CommandPaletteProvider>
  );
}
