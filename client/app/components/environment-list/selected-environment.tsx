import { useProjectStore } from "@/store/project.store.ts";

export function SelectedEnvironment() {
  const { selectedProject } = useProjectStore();
  const environment = selectedProject?.environment;

  if (!environment) return null;

  return (
    <span className="rounded-sm bg-[hsl(var(--blocks-primary-50))] px-1.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--high-emphasis))]">
      {environment}
    </span>
  );
}
