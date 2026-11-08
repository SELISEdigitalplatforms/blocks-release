import { useT } from "@seliseblocks/genesis-os";
import { RenderAlternatively } from "@/components/render-elements";
import { useAppSettingsStore } from "@seliseblocks/genesis-os/store";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface LogoProps {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({
  src,
  alt,
  width,
  height,
  className,
}: Readonly<LogoProps>) {
  const { t } = useT("release.shared");
  const altText = alt ?? t("LOGO.SELISE_LOGO");
  const { settings } = useAppSettingsStore();
  const theme = settings.theme ?? "system";
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  if (src) {
    return (
      <img
        src={src}
        alt={altText}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  return (
    <RenderAlternatively condition={resolvedTheme === "dark"}>
      <img
        src="/Logo_Dark.svg"
        alt={altText}
        width={width}
        height={height}
        className={className}
      />
      <img
        src="/Logo_Light.svg"
        alt={altText}
        width={width}
        height={height}
        className={className}
      />
    </RenderAlternatively>
  );
}
