import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SwipeHighlight {
  id: string;
  transcription_id: string;
  element_id: string;
  start_offset: number;
  end_offset: number;
  text: string;
  created_at: string;
}

// Pass a transcriptionId to scope to a single swipe, or omit for all highlights (planilha).
export function useSwipeHighlights(transcriptionId?: string | null) {
  const [highlights, setHighlights] = useState<SwipeHighlight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("swipe_highlights")
      .select("id, transcription_id, element_id, start_offset, end_offset, text, created_at")
      .order("start_offset", { ascending: true });
    if (transcriptionId) query = query.eq("transcription_id", transcriptionId);
    const { data } = await query;
    setHighlights((data as SwipeHighlight[]) || []);
    setLoading(false);
  }, [transcriptionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addHighlight = useCallback(
    async (row: {
      transcription_id: string;
      element_id: string;
      start_offset: number;
      end_offset: number;
      text: string;
    }): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await (supabase as any)
        .from("swipe_highlights")
        .insert({ ...row, created_by: user.id })
        .select("id, transcription_id, element_id, start_offset, end_offset, text, created_at")
        .single();
      if (error) {
        toast.error("Erro ao grifar");
        return false;
      }
      setHighlights((prev) => [...prev, data as SwipeHighlight]);
      return true;
    },
    [],
  );

  const deleteHighlight = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from("swipe_highlights").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover grifo");
      return;
    }
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return { highlights, loading, addHighlight, deleteHighlight, refetch: fetchAll };
}
