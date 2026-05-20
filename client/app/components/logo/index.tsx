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

  const onLogoClick = () => {
    window.location.href = "/console";
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        onClick={onLogoClick}
      />
    );
  }

  return (
    <RenderAlternatively condition={resolvedTheme === "dark"}>
      <img
        src="/Logo_White.svg"
        alt={alt}
        width={width}
        height={height}
        className={className}
        onClick={onLogoClick}
      />
      <img
        src="/Logo.svg"
        alt={alt}
        width={width}
        height={height}
        className={className}
        onClick={onLogoClick}
      />
    </RenderAlternatively>
  );
}
