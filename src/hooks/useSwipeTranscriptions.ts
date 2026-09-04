import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface SwipeTranscription {
  id: string;
  title: string;
  video_url: string;
  duration: number | null;
  segments: TranscriptSegment[];
  expert_id: string | null;
  offer_id: string | null;
  niche_id: string | null;
  language_id: string | null;
  funnel_type_id: string | null;
  ad_library_link: string;
  funnel_link: string;
  thumbnail_url: string;
  ad_started_on?: string | null;
  days_running?: number | null;
  created_by: string;
  creator_name?: string;
  created_at: string;
}

export function useSwipeTranscriptions() {
  const [transcriptions, setTranscriptions] = useState<SwipeTranscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTranscriptions = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("swipe_transcriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar transcrições");
    } else {
      const rows = (data as SwipeTranscription[]) || [];
      // Resolve creator names (Criado por).
      const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name]));
        rows.forEach((r) => { r.creator_name = map[r.created_by] || ""; });
      }
      setTranscriptions(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTranscriptions();
  }, []);

  const addTranscription = async (row: {
    title: string;
    video_url: string;
    duration: number | null;
    segments: TranscriptSegment[];
    expert_id: string | null;
    offer_id: string | null;
    niche_id: string | null;
    language_id: string | null;
    funnel_type_id: string | null;
    ad_library_link: string;
    funnel_link: string;
    thumbnail_url: string;
  }): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await (supabase as any).from("swipe_transcriptions").insert({
      ...row,
      created_by: user.id,
    });

    if (error) {
      toast.error("Erro ao salvar transcrição");
      return false;
    }
    toast.success("Swipe por transcrição criado!");
    logActivity({
      action: "create",
      entity_type: "swipe",
      entity_name: row.title,
      details: `criou o swipe por transcrição "${row.title}"`,
    });
    fetchTranscriptions();
    return true;
  };

  const updateTranscription = async (
    id: string,
    updates: Partial<Pick<SwipeTranscription, "expert_id" | "offer_id" | "niche_id" | "language_id" | "funnel_type_id" | "ad_library_link" | "funnel_link">>,
  ): Promise<boolean> => {
    const { error } = await (supabase as any).from("swipe_transcriptions").update(updates).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar");
      return false;
    }
    setTranscriptions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    toast.success("Swipe atualizado!");
    return true;
  };

  const deleteTranscription = async (item: SwipeTranscription) => {
    // .select() para detectar exclusão bloqueada por RLS (0 linhas, sem erro) —
    // antes isso "sumia" da tela mas voltava no refresh.
    const { data: del, error } = await (supabase as any)
      .from("swipe_transcriptions")
      .delete()
      .eq("id", item.id)
      .select("id");
    if (error) {
      toast.error("Erro ao excluir transcrição");
      return;
    }
    if (!del || del.length === 0) {
      toast.error("Sem permissão para excluir este swipe.");
      return;
    }
    // Best-effort cleanup of the stored video file.
    try {
      const marker = "/swipe-videos/";
      const idx = item.video_url.indexOf(marker);
      if (idx !== -1) {
        const path = item.video_url.slice(idx + marker.length);
        await supabase.storage.from("swipe-videos").remove([decodeURIComponent(path)]);
      }
    } catch { /* ignore */ }

    toast.success("Transcrição excluída!");
    logActivity({
      action: "delete",
      entity_type: "swipe",
      entity_name: item.title,
      details: `excluiu o swipe por transcrição "${item.title}"`,
    });
    setTranscriptions((prev) => prev.filter((t) => t.id !== item.id));
  };

  return { transcriptions, loading, addTranscription, updateTranscription, deleteTranscription, refetch: fetchTranscriptions };
}
