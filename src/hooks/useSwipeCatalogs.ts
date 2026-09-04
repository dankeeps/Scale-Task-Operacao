import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CatalogItem {
  id: string;
  name: string;
}

export type CatalogKind = "experts" | "offers" | "niches" | "languages" | "funnelTypes";

const TABLES: Record<CatalogKind, string> = {
  experts: "swipe_experts",
  offers: "swipe_offers",
  niches: "swipe_niches",
  languages: "swipe_languages",
  funnelTypes: "swipe_funnel_types",
};

export function useSwipeCatalogs() {
  const [experts, setExperts] = useState<CatalogItem[]>([]);
  const [offers, setOffers] = useState<CatalogItem[]>([]);
  const [niches, setNiches] = useState<CatalogItem[]>([]);
  const [languages, setLanguages] = useState<CatalogItem[]>([]);
  const [funnelTypes, setFunnelTypes] = useState<CatalogItem[]>([]);

  const setters: Record<CatalogKind, (v: CatalogItem[]) => void> = {
    experts: setExperts,
    offers: setOffers,
    niches: setNiches,
    languages: setLanguages,
    funnelTypes: setFunnelTypes,
  };

  const fetchAll = useCallback(async () => {
    const kinds = Object.keys(TABLES) as CatalogKind[];
    await Promise.all(
      kinds.map(async (kind) => {
        const { data } = await (supabase as any)
          .from(TABLES[kind])
          .select("id, name")
          .order("name", { ascending: true });
        setters[kind]((data as CatalogItem[]) || []);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Adds a new catalog entry and returns it (or the existing one on unique clash).
  const addItem = useCallback(
    async (kind: CatalogKind, rawName: string): Promise<CatalogItem | null> => {
      const name = rawName.trim();
      if (!name) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await (supabase as any)
        .from(TABLES[kind])
        .insert({ name, created_by: user.id })
        .select("id, name")
        .single();

      if (error) {
        if (error.code === "23505") {
          // Already exists — fetch and return the existing row
          const { data: existing } = await (supabase as any)
            .from(TABLES[kind])
            .select("id, name")
            .eq("name", name)
            .single();
          if (existing) {
            setters[kind]((prev) =>
              prev.some((i) => i.id === existing.id) ? prev : [...prev, existing].sort((a, b) => a.name.localeCompare(b.name)),
            );
            return existing as CatalogItem;
          }
        }
        toast.error("Erro ao adicionar item");
        return null;
      }

      const item = data as CatalogItem;
      setters[kind]((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
      return item;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  return { experts, offers, niches, languages, funnelTypes, addItem, refetch: fetchAll };
}
