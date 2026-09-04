import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";

export interface Avatar {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
}

// Catálogo de Avatares (personas) por projeto — igual a formatos/tipos de edição.
export function useAvatares() {
  const { currentProject } = useProjectContext();
  const [avatares, setAvatares] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("creative_avatars")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });
    setAvatares((data as Avatar[]) ?? []);
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string): Promise<{ data: Avatar | null; error: any }> => {
    if (!currentProject) return { data: null, error: "no project" };
    const { data, error } = await (supabase as any)
      .from("creative_avatars")
      .insert({ name, project_id: currentProject.id })
      .select()
      .single();
    if (!error && data) setAvatares((prev) => [data as Avatar, ...prev]);
    return { data: (data as Avatar) ?? null, error };
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("creative_avatars").delete().eq("id", id);
    if (!error) setAvatares((prev) => prev.filter((a) => a.id !== id));
    return { error };
  };

  return { avatares, loading, add, remove, refetch: fetch };
}
