import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  CommandPalette,
  resolveSharedCommands,
  useAuthStore,
  useCommandLayer,
  useGetProjects,
  useProjectStore,
  useStartImpersonation,
  useThemePaletteActions,
  type CommandPaletteProps,
  type IProject,
  type PaletteAction,
} from "@seliseblocks/app-kit";
import { toast } from "sonner";
import { useReleaseNavigation } from "@/hooks/use-release-navigation";

const PaletteContext = createContext<(open: boolean) => void>(() => undefined);
export const useCommandPalette = () => useContext(PaletteContext);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const layer = useCommandLayer();
  const sections = useReleaseNavigation();
  const { itemId } = useParams();
  const { pathname } = useLocation();
  const [previousScope, setPreviousScope] = useState({ pathname, authenticated });
  if (previousScope.pathname !== pathname || previousScope.authenticated !== authenticated) {
    setPreviousScope({ pathname, authenticated });
    setOpen(false);
  }
  const navigate = useNavigate();
  const { selectedProject, setSelectedProject, setTenantGroup } = useProjectStore();
  const currentProject = selectedProject?.itemId === itemId ? selectedProject : null;
  const { mutateAsync: startImpersonation } = useStartImpersonation();
  const { data: projectGroups } = useGetProjects({ enabled: authenticated && open });
  const { data: currentGroupEnvironments } = useGetProjects({
    tenantGroupId: currentProject?.tenantGroupId,
    enabled: authenticated && open && !!currentProject?.tenantGroupId,
  });

  useEffect(() => {
    if (!authenticated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        !event.isComposing &&
        !event.repeat &&
        !event.altKey &&
        event.key.toLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authenticated]);

  const commands = useMemo<CommandPaletteProps["commands"]>(
    () => ({
      scope: {
        layer,
        itemId,
        tenantGroupId: currentProject?.tenantGroupId,
        projectName: currentProject?.name,
        environmentName: currentProject?.environment,
      },
      // View Console, View Profile: defined once in app-kit and shared with every Blocks app.
      ...resolveSharedCommands(layer),
    }),
    [layer, itemId, currentProject],
  );

  const enterEnvironment = async (project: IProject) => {
    try {
      await startImpersonation({ targeted_tenant_id: project.tenantId });
      setTenantGroup(project.tenantGroupId);
      setSelectedProject(project);
      navigate(`/app/${project.itemId}/dashboard`);
    } catch {
      toast.error("Unable to switch environment. Please try again.");
    }
  };

  // The engine's project rows lead to Console's /app/project subtree, which Release
  // does not have. Offer environment entries with Release's impersonation flow instead.
  // Light / dark / system, shared with every Blocks app's palette through app-kit.
  const themeActions = useThemePaletteActions();
  const actions: PaletteAction[] = (projectGroups ?? [])
    .filter((group) => !group.isShared || !group.accessPolicies || group.accessPolicies.length > 0)
    .filter((group) => layer === "console" || group.tenantGroupId !== currentProject?.tenantGroupId)
    .flatMap((group) => group.projects)
    .filter((project) => !project.isDisabled)
    .map((project) => ({
      id: `enter-environment:${project.itemId}`,
      group: layer === "console" ? "Environments" : "Switch Project",
      name: `${project.name} · ${project.environment}`,
      desc: "Open this environment in Release",
      keywords: [project.name, project.environment, "project", "environment", "switch"],
      run: () => {
        void enterEnvironment(project);
      },
    }));

  return (
    <PaletteContext.Provider value={setOpen}>
      {children}
      {authenticated && (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          layer={layer}
          commands={commands}
          sections={sections}
          currentGroupEnvironments={currentGroupEnvironments}
          selectedTenantGroup={currentProject?.tenantGroupId}
          selectedProject={currentProject}
          onEnterEnvironment={enterEnvironment}
          actions={[...actions, ...themeActions]}
          typewriterHints={{
            console: ["Find a project", "View Profile"],
            project: [],
            dashboard: ["View Deployment", "View Overview", "Switch environment"],
          }}
        />
      )}
    </PaletteContext.Provider>
  );
}
