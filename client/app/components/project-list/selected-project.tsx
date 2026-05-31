import { FolderOpen } from "lucide-react";
import { useProjectStore } from "@/store/project.store.ts";

export function SelectedProject() {
  const { selectedProject } = useProjectStore();
  const projectName = selectedProject?.name;

  if (!projectName) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-sm font-medium text-foreground">
        {projectName}
      </span>
    </div>
  );
}
