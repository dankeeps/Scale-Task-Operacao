import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";

export interface EducationalCategory {
  id: string;
  name: string;
}

export interface EducationalContent {
  id: string;
  name: string;
  category_id: string | null;
  youtube_url: string | null;
  video_url: string | null;
  material_link: string | null;
  responsible_id: string;
  created_by: string;
  created_at: string;
  category?: EducationalCategory | null;
  responsible?: { full_name: string; avatar_url: string | null } | null;
}

export function useEducational() {
  const [content, setContent] = useState<EducationalContent[]>([]);
  const [categories, setCategories] = useState<EducationalCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("educational_categories")
      .select("*")
      .order("name");
    if (data) setCategories(data);
  };

  const fetchContent = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("educational_content")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch categories and profiles
      const catIds = [...new Set(data.filter(d => d.category_id).map(d => d.category_id!))];
      const userIds = [...new Set(data.map(d => d.responsible_id))];

      const [catsRes, profilesRes] = await Promise.all([
        catIds.length > 0
          ? supabase.from("educational_categories").select("*").in("id", catIds)
          : Promise.resolve({ data: [] as EducationalCategory[] }),
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      ]);

      const catsMap = new Map((catsRes.data || []).map(c => [c.id, c]));
      const profilesMap = new Map((profilesRes.data || []).map(p => [p.id, p]));

      const enriched: EducationalContent[] = data.map(item => ({
        ...item,
        category: item.category_id ? catsMap.get(item.category_id) || null : null,
        responsible: profilesMap.get(item.responsible_id) || null,
      }));

      setContent(enriched);
    } else {
      setContent([]);
    }
    setLoading(false);
  };

  const addCategory = async (name: string) => {
    const { data, error } = await supabase
      .from("educational_categories")
      .insert({ name })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar categoria"); return null; }
    setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const addContent = async (values: { name: string; category_id: string | null; youtube_url?: string | null; video_url?: string | null; responsible_id: string; material_link?: string | null }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from("educational_content")
      .insert({
        name: values.name,
        category_id: values.category_id,
        youtube_url: values.youtube_url || null,
        video_url: values.video_url || null,
        responsible_id: values.responsible_id,
        material_link: values.material_link ?? null,
        created_by: user.id,
      } as never);
    if (error) { toast.error("Erro ao adicionar conteúdo"); return false; }
    toast.success("Conteúdo adicionado!");
    logActivity({
      action: "create",
      entity_type: "educacional",
      entity_name: values.name,
      details: `adicionou o conteúdo educacional "${values.name}"`,
    });
    await fetchContent();
    return true;
  };

  const deleteContent = async (id: string) => {
    const { error } = await supabase.from("educational_content").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setContent(prev => prev.filter(c => c.id !== id));
    toast.success("Conteúdo excluído");
  };

  useEffect(() => {
    fetchCategories();
    fetchContent();
  }, []);

  return { content, categories, loading, addCategory, addContent, deleteContent, refetch: fetchContent };
}
