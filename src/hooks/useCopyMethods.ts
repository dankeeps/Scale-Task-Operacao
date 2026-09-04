import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";

export interface CopyMethod {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
}

// Catálogo "Método de Copy" por projeto — igual a avatares/formatos.
export function useCopyMethods() {
  const { currentProject } = useProjectContext();
  const [copyMethods, setCopyMethods] = useState<CopyMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("creative_copy_methods")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });
    setCopyMethods((data as CopyMethod[]) ?? []);
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string): Promise<{ data: CopyMethod | null; error: any }> => {
    if (!currentProject) return { data: null, error: "no project" };
    const { data, error } = await (supabase as any)
      .from("creative_copy_methods")
      .insert({ name, project_id: currentProject.id })
      .select()
      .single();
    if (!error && data) setCopyMethods((prev) => [data as CopyMethod, ...prev]);
    return { data: (data as CopyMethod) ?? null, error };
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("creative_copy_methods").delete().eq("id", id);
    if (!error) setCopyMethods((prev) => prev.filter((c) => c.id !== id));
    return { error };
  };

  return { copyMethods, loading, add, remove, refetch: fetch };
}
