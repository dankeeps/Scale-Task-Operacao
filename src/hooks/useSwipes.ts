import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";

export interface Swipe {
  id: string;
  offer_name: string;
  library_link: string;
  site_url: string;
  active_ads_count: number;
  niche: string;
  spy_date: string | null;
  swipe_link: string;
  image_url: string;
  image_position: number;
  created_by: string;
  created_at: string;
}

export interface SwipeHistory {
  id: string;
  swipe_id: string;
  active_ads_count: number;
  spy_date: string | null;
  created_at: string;
}

export function useSwipes() {
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSwipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("swipes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar swipes");
    } else {
      setSwipes((data as Swipe[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSwipes();
  }, []);

  const addSwipe = async (swipe: Omit<Swipe, "id" | "created_at" | "created_by">) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("swipes").insert({
      ...swipe,
      created_by: user.id,
    } as any);

    if (error) {
      toast.error("Erro ao criar swipe");
    } else {
      toast.success("Swipe criado!");
      logActivity({
        action: "create",
        entity_type: "swipe",
        entity_name: swipe.offer_name,
        details: `criou o swipe "${swipe.offer_name}"`,
      });
      fetchSwipes();
    }
  };

  const deleteSwipe = async (id: string) => {
    const swipe = swipes.find((s) => s.id === id);
    const { error } = await supabase.from("swipes").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir swipe");
    } else {
      toast.success("Swipe excluído!");
      logActivity({
        action: "delete",
        entity_type: "swipe",
        entity_name: swipe?.offer_name || "Sem nome",
        details: `excluiu o swipe "${swipe?.offer_name || "Sem nome"}"`,
      });
      setSwipes((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const updateSwipe = async (id: string, data: { active_ads_count: number; spy_date: string | null }) => {
    const { error } = await supabase.from("swipes").update(data as any).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar swipe");
      return;
    }
    // Save to history
    await supabase.from("swipe_history").insert({
      swipe_id: id,
      active_ads_count: data.active_ads_count,
      spy_date: data.spy_date,
    } as any);
    toast.success("Swipe atualizado!");
    setSwipes((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s));
  };

  const fetchHistory = async (swipeId: string): Promise<SwipeHistory[]> => {
    const { data, error } = await supabase
      .from("swipe_history")
      .select("*")
      .eq("swipe_id", swipeId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data as SwipeHistory[]) || [];
  };

  return { swipes, loading, addSwipe, deleteSwipe, updateSwipe, fetchHistory };
}
