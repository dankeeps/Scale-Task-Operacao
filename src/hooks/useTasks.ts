import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Task {
  id: string;
  project_id: string;
  project_name?: string;
  name: string;
  description: string;
  assigned_to: string | null;
  assigned_name?: string;
  assigned_avatar?: string | null;
  created_by: string | null;
  due_date: string | null;
  status: "pendente" | "em_progresso" | "concluida" | "arquivada";
  priority?: string;
  recurrence?: "none" | "weekly" | "monthly";
  directors_only?: boolean;
  created_at: string;
  ad_id: string | null;
  remessa_name?: string;
  drive_link?: string;
  offer_name?: string;
  link?: string;
  folder_id?: string | null;
  file_name?: string | null;
  flow_instance_id?: string | null;
  flow_step_index?: number | null;
}

export function useTasks(projectIds: string[]) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (projectIds.length === 0) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .in("project_id", projectIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      setTasks([]);
      setLoading(false);
      return;
    }

    // Get project names
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);

    const projMap = Object.fromEntries(
      (projects ?? []).map((p) => [p.id, p.name])
    );

    // Get assigned user names
    const assignedIds = [...new Set(data.filter((t) => t.assigned_to).map((t) => t.assigned_to!))];
    let profileMap: Record<string, string> = {};
    let avatarMap: Record<string, string> = {};
    if (assignedIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", assignedIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.full_name])
      );
      avatarMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p.avatar_url || ""])
      );
    }

    // Get remessa names for creative tasks (ad → document → remessa)
    const adIds = [...new Set(data.filter((t) => t.ad_id).map((t) => t.ad_id!))];
    let adRemessaMap: Record<string, string> = {};
    let adDriveLinkMap: Record<string, string> = {};
    if (adIds.length > 0) {
      const { data: ads } = await supabase
        .from("creative_ads")
        .select("id, document_id")
        .in("id", adIds);

      if (ads && ads.length > 0) {
        const docIds = [...new Set(ads.map((a) => a.document_id))];
        const { data: docs } = await supabase
          .from("creative_documents")
          .select("id, remessa_id, link")
          .in("id", docIds);

        const remessaIds = [...new Set((docs ?? []).filter((d) => d.remessa_id).map((d) => d.remessa_id!))];
        let remessaMap: Record<string, string> = {};
        if (remessaIds.length > 0) {
          const { data: remessas } = await supabase
            .from("remessas")
            .select("id, name")
            .in("id", remessaIds);
          remessaMap = Object.fromEntries((remessas ?? []).map((r) => [r.id, r.name]));
        }

        const docRemessaMap = Object.fromEntries(
          (docs ?? []).map((d) => [d.id, d.remessa_id ? remessaMap[d.remessa_id] || "" : ""])
        );
        const docLinkMap = Object.fromEntries(
          (docs ?? []).map((d) => [d.id, d.link || ""])
        );
        const adDocMap = Object.fromEntries(ads.map((a) => [a.id, a.document_id]));
        adRemessaMap = Object.fromEntries(
          adIds.map((adId) => [adId, docRemessaMap[adDocMap[adId]] || ""])
        );
        adDriveLinkMap = Object.fromEntries(
          adIds.map((adId) => [adId, docLinkMap[adDocMap[adId]] || ""])
        );
      }
    }

    setTasks(
      data.map((t) => ({
        ...t,
        status: t.status as Task["status"],
        project_name: projMap[t.project_id] || "",
        assigned_name: t.assigned_to ? profileMap[t.assigned_to] || "" : "",
        assigned_avatar: t.assigned_to ? avatarMap[t.assigned_to] || null : null,
        remessa_name: t.ad_id ? adRemessaMap[t.ad_id] || "" : "",
        drive_link: t.ad_id ? adDriveLinkMap[t.ad_id] || "" : "",
        offer_name: (t as any).offer_name || "",
        link: (t as any).link || "",
        folder_id: (t as any).folder_id || null,
      }))
    );
    setLoading(false);
  }, [projectIds.join(",")]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, refetch: fetchTasks };
}
