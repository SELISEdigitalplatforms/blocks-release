import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The console's expanding search shell (app-kit `SearchField`), kept local to the deployment
 * screens because the packaged app-kit release does not export it. Collapsed it is a single
 * icon button; it opens on click, or stays open while it holds a value, and Escape closes it.
 */
export function SearchField({
  value,
  label = "Search",
  disabled = false,
  className,
  paddingTarget = "container",
  expandable = true,
  showIcon = true,
  children,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  paddingTarget?: "container" | "input";
  expandable?: boolean;
  /** Draw the leading search icon when not expandable. */
  showIcon?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const reducedMotion = useReducedMotion();
  const open = !expandable || (expanded ?? !!value);
  useEffect(() => {
    if (expanded) containerRef.current?.querySelector("input")?.focus({ preventScroll: true });
  }, [expanded]);
  return (
    <motion.div
      ref={containerRef}
      initial={false}
      animate={{ width: open ? "auto" : 36 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      className="relative ml-auto flex h-9 w-fit min-w-9 max-w-full items-center self-start overflow-hidden rounded-sm"
      onKeyDown={(event) => {
        if (expandable && event.key === "Escape" && open) {
          event.stopPropagation();
          setExpanded(false);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }
      }}
    >
      {expandable ? (
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          disabled={disabled}
          onClick={() => setExpanded(!open)}
          className={cn(
            "absolute left-px top-0 z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-high-emphasis focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            open
              ? "bg-transparent"
              : "border border-border-default bg-card shadow-xs hover:bg-accent",
          )}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : showIcon ? (
        <span
          className="pointer-events-none absolute left-px top-0 flex h-9 w-9 items-center justify-center text-muted-foreground"
          aria-hidden="true"
        >
          <Search className="h-4 w-4" />
        </span>
      ) : null}
      <div
        id={id}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "flex h-9 w-max min-w-0 shrink-0 items-center",
          className,
          (expandable || showIcon) &&
            (paddingTarget === "input" ? "[&_input]:pl-9" : "[&>div]:pl-9"),
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
