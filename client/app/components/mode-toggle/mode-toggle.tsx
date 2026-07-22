import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { useAppSettingsStore } from "@seliseblocks/blocks-kit/store";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ModeToggle() {
  const { settings, setSettings } = useAppSettingsStore();
  const theme = settings.theme ?? "system";
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  const setTheme = (newTheme: Theme) => {
    setSettings({ theme: newTheme });
    const resolved = newTheme === "system" ? getSystemTheme() : newTheme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  return (
    <Button
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full border border-transparent transition-all hover:border-[hsl(var(--border-default))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] hover:shadow-sm"
    >
      <Moon className="aspect-square w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Sun className="absolute aspect-square w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}