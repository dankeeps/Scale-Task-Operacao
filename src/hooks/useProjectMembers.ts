import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";

export interface ProjectMember {
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

export function useProjectMembers() {
  const { currentProject } = useProjectContext();
  const [members, setMembers] = useState<ProjectMember[]>([]);

  const fetch = useCallback(async () => {
    if (!currentProject) return;
    const { data } = await supabase
      .from("user_projects")
      .select("user_id, role")
      .eq("project_id", currentProject.id);

    if (!data) { setMembers([]); return; }

    // Fetch profile names for all members
    const userIds = data.map((d) => d.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.full_name])
    );

    setMembers(
      data.map((d) => ({
        ...d,
        full_name: profileMap[d.user_id] || undefined,
      }))
    );
  }, [currentProject]);

  useEffect(() => { fetch(); }, [fetch]);

  return { members };
}
