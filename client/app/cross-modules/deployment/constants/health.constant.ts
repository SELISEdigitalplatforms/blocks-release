export const TABS = {
  all: { label: "All services", monitorSourceType: undefined },
  services: { label: "Blocks services", monitorSourceType: 2 },
  deployed: { label: "Deployed services", monitorSourceType: 1 },
  external: { label: "My services", monitorSourceType: 3 },
} as const;
export type TabKey = keyof typeof TABS;
