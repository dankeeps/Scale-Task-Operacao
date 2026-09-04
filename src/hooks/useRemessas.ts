import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";

export interface Remessa {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
}

export function useRemessas() {
  const { currentProject } = useProjectContext();
  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    const { data } = await supabase
      .from("remessas")
      .select("*")
      .eq("project_id", currentProject.id)
      .order("created_at", { ascending: false });
    setRemessas(data ?? []);
    setLoading(false);
  }, [currentProject]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (name: string) => {
    if (!currentProject) return;
    const { data, error } = await supabase
      .from("remessas")
      .insert({ name, project_id: currentProject.id })
      .select()
      .single();
    if (!error && data) setRemessas((prev) => [data, ...prev]);
    return { data, error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("remessas").delete().eq("id", id);
    if (!error) setRemessas((prev) => prev.filter((r) => r.id !== id));
    return { error };
  };

  return { remessas, loading, add, remove, refetch: fetch };
}
