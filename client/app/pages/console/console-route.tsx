import { ConsolePage } from "@seliseblocks/app-kit";
import { useCommandPalette } from "@/components/command-palette/command-palette-provider";

export function ConsoleRoute() {
  const openCommands = useCommandPalette();
  return <ConsolePage onOpenCommands={() => openCommands(true)} />;
}
