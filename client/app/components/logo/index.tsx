import { useTheme } from "@/hooks/use-theme";
import { RenderAlternatively } from "@/components/render-elements";

interface LogoProps {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ src, alt = "SELISE Logo", width, height, className }: LogoProps) {
  const { resolvedTheme } = useTheme();

  if (src) {
    return <img src={src} alt={alt} width={width} height={height} className={className} />;
  }

  return (
    <RenderAlternatively condition={resolvedTheme === "dark"}>
      <img
        src="/Logo_White.svg"
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
      <img
        src="/Logo.svg"
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    </RenderAlternatively>
  );
}
