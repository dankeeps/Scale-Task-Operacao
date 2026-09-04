import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CatalogSelect } from "@/components/swipe/CatalogSelect";
import type { CatalogItem, CatalogKind } from "@/hooks/useSwipeCatalogs";
import type { SwipeTranscription } from "@/hooks/useSwipeTranscriptions";

interface Props {
  transcription: SwipeTranscription | null;
  experts: CatalogItem[];
  offers: CatalogItem[];
  niches: CatalogItem[];
  languages: CatalogItem[];
  funnelTypes: CatalogItem[];
  onAddCatalog: (kind: CatalogKind, name: string) => Promise<CatalogItem | null>;
  onSave: (id: string, updates: {
    expert_id: string | null;
    offer_id: string | null;
    niche_id: string | null;
    language_id: string | null;
    funnel_type_id: string | null;
    ad_library_link: string;
    funnel_link: string;
  }) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
}

export function EditTranscriptionDialog({
  transcription, experts, offers, niches, languages, funnelTypes, onAddCatalog, onSave, onOpenChange,
}: Props) {
  const [expertId, setExpertId] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [nicheId, setNicheId] = useState<string | null>(null);
  const [languageId, setLanguageId] = useState<string | null>(null);
  const [funnelTypeId, setFunnelTypeId] = useState<string | null>(null);
  const [adLibraryLink, setAdLibraryLink] = useState("");
  const [funnelLink, setFunnelLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transcription) return;
    setExpertId(transcription.expert_id);
    setOfferId(transcription.offer_id);
    setNicheId(transcription.niche_id);
    setLanguageId(transcription.language_id);
    setFunnelTypeId(transcription.funnel_type_id);
    setAdLibraryLink(transcription.ad_library_link || "");
    setFunnelLink(transcription.funnel_link || "");
  }, [transcription]);

  const handleSave = async () => {
    if (!transcription) return;
    setSaving(true);
    const ok = await onSave(transcription.id, {
      expert_id: expertId,
      offer_id: offerId,
      niche_id: nicheId,
      language_id: languageId,
      funnel_type_id: funnelTypeId,
      ad_library_link: adLibraryLink.trim(),
      funnel_link: funnelLink.trim(),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={!!transcription} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-popover sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Editar swipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <CatalogSelect label="Expert" items={experts} value={expertId} onChange={setExpertId} onAdd={(n) => onAddCatalog("experts", n)} />
          <CatalogSelect label="Oferta" items={offers} value={offerId} onChange={setOfferId} onAdd={(n) => onAddCatalog("offers", n)} />
          <CatalogSelect label="Nicho" items={niches} value={nicheId} onChange={setNicheId} onAdd={(n) => onAddCatalog("niches", n)} />
          <CatalogSelect label="Idioma" items={languages} value={languageId} onChange={setLanguageId} onAdd={(n) => onAddCatalog("languages", n)} />
          <CatalogSelect label="Tipo de funil" items={funnelTypes} value={funnelTypeId} onChange={setFunnelTypeId} onAdd={(n) => onAddCatalog("funnelTypes", n)} />

          <div className="space-y-1">
            <Label className="text-2xs">Link do funil</Label>
            <Input
              value={funnelLink}
              onChange={(e) => setFunnelLink(e.target.value)}
              placeholder="https://..."
              className="h-8 text-2xs bg-secondary/30 border-border/50"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-2xs">Ad Library</Label>
            <Input
              value={adLibraryLink}
              onChange={(e) => setAdLibraryLink(e.target.value)}
              placeholder="https://www.facebook.com/ads/library/..."
              className="h-8 text-2xs bg-secondary/30 border-border/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-8 text-2xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-2xs" disabled={saving} onClick={handleSave}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
