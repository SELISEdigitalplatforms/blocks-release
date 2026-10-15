/*
 * Console surface styles for the deployment screens.
 *
 * The shared ui-kit Card, Tabs, Table and outline Button still carry the older look (bordered
 * card with a drop shadow, pill tabs, muted table headers). These classes give the deployment
 * screens the console treatment locally, without restyling every other screen that uses the kit.
 * Each override is written against the kit's own classes so tailwind-merge drops the defaults.
 */

/** A paper card: hairline ring, no border or drop shadow. Use on a plain element, not the kit Card. */
export const SURFACE_CARD_CLASS =
  "rounded-sm bg-card px-5 py-6 text-card-foreground shadow-surface-ring sm:px-8 sm:py-8";

/** Underline tab strip, replacing the kit's pill TabsList. */
export const UNDERLINE_TABS_LIST_CLASS =
  "h-9 max-w-full shrink-0 justify-start gap-5 overflow-x-auto rounded-none border-0 border-b border-border bg-transparent p-0 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Underline tab, replacing the kit's pill TabsTrigger. */
export const UNDERLINE_TAB_TRIGGER_CLASS =
  "h-full shrink-0 cursor-pointer rounded-none border-b-2 border-transparent px-1 py-0 text-muted-foreground transition-colors hover:text-high-emphasis focus-visible:ring-inset focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

/** The console's outline button: card fill, muted label, warm hover. */
export const OUTLINE_BUTTON_CLASS =
  "border-border bg-card text-muted-foreground hover:bg-surface-warm hover:text-high-emphasis";

/** Table wrapper: the table draws its own card. */
export const TABLE_CARD_CLASS = "overflow-hidden rounded-sm bg-card shadow-surface-ring";

/** Header row and cells: small uppercase labels over a hairline. */
export const TABLE_HEAD_ROW_CLASS = "border-border-default hover:bg-transparent";
export const TABLE_HEAD_CLASS =
  "h-10 px-5 text-xs font-semibold uppercase tracking-wide text-high-emphasis md:px-5";

/** Body rows and cells: roomy cells over faint separators, warm hover tint. */
export const TABLE_ROW_CLASS = "border-border/50 hover:bg-surface-warm/40";
export const TABLE_CELL_CLASS = "px-5 py-4 md:px-5 md:py-4";
