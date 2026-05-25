import { motion } from "framer-motion";
import { useGetProjects } from "@/cross-modules/identifier/hooks/use-project";
import { ProjectCard } from "@/components/project-card/project-card";
import { ProjectCardLoading } from "@/components/project-card/loading";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const SelfProjectLoading = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array(8)
        .fill(null)
        .map((_item, index) => (
          <ProjectCardLoading key={index} />
        ))}
    </div>
  );
};

export const SelfProject = () => {
  const { data, isLoading, isFetching } = useGetProjects({});
  if (isLoading || isFetching) return <SelfProjectLoading />;
  const projectGroups = data || [];

  if (!projectGroups.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
        <h2 className="text-base font-semibold text-[hsl(var(--high-emphasis))]">
          No projects found
        </h2>
        <p className="max-w-md text-sm text-[hsl(var(--medium-emphasis))]">
          You don&apos;t have any Blocks projects yet. Create a project from the
          Blocks console to get started with deployments.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="shrink-0 text-base font-semibold text-[hsl(var(--high-emphasis))]">
            Your Blocks Projects
          </h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {projectGroups.length}
          </span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {projectGroups.map((project, i) => (
          <motion.div
            key={project.tenantGroupId}
            variants={cardVariants}
            custom={i}
            initial="hidden"
            animate="visible">
            <ProjectCard
              project={project.projects[0]}
              projects={project.projects}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
};
