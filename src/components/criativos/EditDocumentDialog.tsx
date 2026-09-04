import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { AdForm, AdData, emptyAd } from "./AdForm";
import { Remessa } from "@/hooks/useRemessas";
import { Formato } from "@/hooks/useFormatos";
import { Avatar } from "@/hooks/useAvatares";
import { CopyMethod } from "@/hooks/useCopyMethods";
import { ProjectMember } from "@/hooks/useProjectMembers";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { toast } from "sonner";

interface DocWithAds {
  id: string;
  remessa_id: string | null;
  link?: string;
  ads: any[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocWithAds;
  remessas: Remessa[];
  formatos: Formato[];
  avatares: Avatar[];
  onAddAvatar: (name: string) => Promise<Avatar | null>;
  copyMethods: CopyMethod[];
  onAddCopyMethod: (name: string) => Promise<CopyMethod | null>;
  members: ProjectMember[];
  onSaved: () => void;
}

function adToFormData(ad: any): AdData {
  return {
    name: ad.name ?? "",
    briefing: ad.briefing ?? "",
    status: ad.status ?? "enviado_gravacao",
    validacao: ad.validacao ?? false,
    copywriter_id: ad.copywriter_id ?? "",
    formato_id: ad.formato_id ?? "",
    avatar_id: ad.avatar_id ?? "",
    copy_method_id: ad.copy_method_id ?? "",
    referencia: ad.referencia ?? "",
    notas_editor: ad.notas_editor ?? "",
    notas_gravacao: ad.notas_gravacao ?? "",
    texto: ad.texto ?? "",
    hook_rate: ad.hook_rate != null ? String(ad.hook_rate) : "",
    hold_rate: ad.hold_rate != null ? String(ad.hold_rate) : "",
    cpm: ad.cpm != null ? String(ad.cpm) : "",
    conv_checkout: ad.conv_checkout != null ? String(ad.conv_checkout) : "",
    cic: ad.cic != null ? String(ad.cic) : "",
    cpc: ad.cpc != null ? String(ad.cpc) : "",
    retencao_1min: ad.retencao_1min != null ? String(ad.retencao_1min) : "",
    retencao_pitch: ad.retencao_pitch != null ? String(ad.retencao_pitch) : "",
    conversao_vsl: ad.conversao_vsl != null ? String(ad.conversao_vsl) : "",
    faturamento: ad.faturamento != null ? String(ad.faturamento) : "",
    investimento: ad.investimento != null ? String(ad.investimento) : "",
    roas: ad.roas != null ? String(ad.roas) : "",
    faturamento_backend: ad.faturamento_backend != null ? String(ad.faturamento_backend) : "",
  };
}

export function EditDocumentDialog({ open, onOpenChange, document, remessas, formatos, avatares, onAddAvatar, copyMethods, onAddCopyMethod, members, onSaved }: Props) {
  const { currentProject } = useProjectContext();
  const [remessaId, setRemessaId] = useState(document.remessa_id ?? "");
  const [link, setLink] = useState(document.link ?? "");
  const [ads, setAds] = useState<(AdData & { _id?: string })[]>(
    document.ads.map((a) => ({ ...adToFormData(a), _id: a.id }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRemessaId(document.remessa_id ?? "");
    setLink(document.link ?? "");
    setAds(document.ads.map((a) => ({ ...adToFormData(a), _id: a.id })));
  }, [document]);

  const updateAd = (index: number, data: AdData) => {
    setAds((prev) => prev.map((a, i) => (i === index ? { ...data, _id: a._id } : a)));
  };

  const addAd = () => setAds((prev) => [...prev, { ...emptyAd }]);

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);

    // Update document remessa
    const { error: docErr } = await supabase
      .from("creative_documents")
      .update({ remessa_id: remessaId || null, link: link || "" })
      .eq("id", document.id);

    if (docErr) {
      toast.error("Erro ao atualizar documento");
      setSaving(false);
      return;
    }

    // Delete old ads and re-insert all
    await supabase.from("creative_ads").delete().eq("document_id", document.id);

    const adsToInsert = ads.map((ad) => ({
      document_id: document.id,
      project_id: currentProject.id,
      name: ad.name,
      briefing: ad.briefing || null,
      status: ad.status as any,
      validacao: ad.validacao,
      copywriter_id: ad.copywriter_id || null,
      formato_id: ad.formato_id || null,
      avatar_id: ad.avatar_id || null,
      copy_method_id: ad.copy_method_id || null,
      referencia: ad.referencia || null,
      notas_editor: ad.notas_editor || null,
      notas_gravacao: ad.notas_gravacao || null,
      texto: ad.texto || "",
      hook_rate: ad.hook_rate ? parseFloat(ad.hook_rate) : null,
      hold_rate: ad.hold_rate ? parseFloat(ad.hold_rate) : null,
      cpm: ad.cpm ? parseFloat(ad.cpm) : null,
      conv_checkout: ad.conv_checkout ? parseFloat(ad.conv_checkout) : null,
      cic: ad.cic ? parseFloat(ad.cic) : null,
      cpc: ad.cpc ? parseFloat(ad.cpc) : null,
      retencao_1min: ad.retencao_1min ? parseFloat(ad.retencao_1min) : null,
      retencao_pitch: ad.retencao_pitch ? parseFloat(ad.retencao_pitch) : null,
      conversao_vsl: ad.conversao_vsl ? parseFloat(ad.conversao_vsl) : null,
      faturamento: ad.faturamento ? parseFloat(ad.faturamento) : null,
      investimento: ad.investimento ? parseFloat(ad.investimento) : null,
      roas: ad.roas ? parseFloat(ad.roas) : null,
      faturamento_backend: ad.faturamento_backend ? parseFloat(ad.faturamento_backend) : null,
    }));

    const { error: adsErr } = await supabase.from("creative_ads").insert(adsToInsert as any);

    if (adsErr) {
      toast.error("Erro ao salvar anúncios");
    } else {
      toast.success("Documento atualizado!");
      onOpenChange(false);
      onSaved();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Editar Documento</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 min-h-0">
          <div className="space-y-6 pb-4 px-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Remessa</Label>
              <Select value={remessaId} onValueChange={setRemessaId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma remessa" /></SelectTrigger>
                <SelectContent>
                  {remessas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Link */}
            <div className="space-y-1.5">
              <Label className="text-xs">Link (pasta do Drive)</Label>
              <Input placeholder="https://drive.google.com/..." value={link} onChange={(e) => setLink(e.target.value)} />
            </div>

            {ads.map((ad, i) => (
              <AdForm
                key={i}
                index={i}
                data={ad}
                onChange={(d) => updateAd(i, d)}
                onRemove={ads.length > 1 ? () => setAds((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
                formatos={formatos}
                avatares={avatares}
                onAddAvatar={onAddAvatar}
                copyMethods={copyMethods}
                onAddCopyMethod={onAddCopyMethod}
                members={members}
                metricsAuto
              />
            ))}

            <Button variant="outline" className="w-full" onClick={addAd}>
              <Plus className="h-4 w-4 mr-1.5" />
              Criar novo anúncio
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
