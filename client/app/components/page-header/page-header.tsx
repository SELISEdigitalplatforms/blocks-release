import { cn } from "@/lib/utils";
import type { ReactNode, Ref } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  className?: string;
  actions?: ReactNode;
  titleSuffix?: ReactNode;
  toolbarRef?: Ref<HTMLDivElement>;
  toolbar?: ReactNode;
};

export const PageHeader = ({
  title,
  description,
  className,
  actions,
  titleSuffix,
  toolbarRef,
  toolbar,
}: PageHeaderProps) => {
  const heading = (
    <>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--high-emphasis))] sm:text-2xl">
          {title}
        </h1>
        {titleSuffix}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </>
  );

  if (toolbarRef || toolbar || actions) {
    return (
      <header
        className={cn(
          "mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4",
          className,
        )}
      >
        <div className="min-w-0 flex-1 basis-64 space-y-1">{heading}</div>
        <div ref={toolbarRef} className="ml-auto w-full min-w-0 max-w-full sm:w-auto">
          {toolbar ?? (
            <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
          )}
        </div>
      </header>
    );
  }

  return <header className={cn("mb-4 space-y-1 sm:mb-6", className)}>{heading}</header>;
};
