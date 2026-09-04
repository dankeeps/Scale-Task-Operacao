import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Project {
  id: string;
  name: string;
  role: string;
  image_url?: string | null;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_projects")
        .select("role, project_id, projects:project_id(id, name, image_url)")
        .eq("user_id", user.id);

      if (!error && data) {
        const mapped: Project[] = data.map((up: any) => ({
          id: up.projects.id,
          name: up.projects.name,
          role: up.role,
          image_url: up.projects.image_url,
        }));
        setProjects(mapped);

        // Restore from localStorage or pick first
        const savedId = localStorage.getItem("scaletask_current_project");
        const saved = mapped.find((p) => p.id === savedId);
        setCurrentProject(saved || mapped[0] || null);
      }
      setLoading(false);
    };

    fetchProjects();
  }, []);

  const selectProject = (project: Project) => {
    setCurrentProject(project);
    localStorage.setItem("scaletask_current_project", project.id);
  };

  const addProject = (project: Project) => {
    setProjects((prev) => [...prev, project]);
    selectProject(project);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    if (currentProject?.id === id) {
      setCurrentProject((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  return { projects, currentProject, selectProject, addProject, updateProject, loading };
}
