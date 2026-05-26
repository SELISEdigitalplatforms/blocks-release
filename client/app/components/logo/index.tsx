import { RenderAlternatively } from "@/components/render-elements";
import { useTheme } from "@/hooks/use-theme";

interface LogoProps {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({
  src,
  alt = "SELISE Logo",
  width,
  height,
  className,
}: LogoProps) {
  const { resolvedTheme } = useTheme();

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
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
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
      <img
        src="/Logo_Light.svg"
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    </RenderAlternatively>
  );
}
