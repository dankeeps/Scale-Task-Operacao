import { createContext, useContext, ReactNode } from "react";
import { useProjects, Project } from "@/hooks/useProjects";

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  selectProject: (project: Project) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const value = useProjects();
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider");
  return ctx;
}
