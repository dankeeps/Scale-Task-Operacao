import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EducationalCategory } from "@/hooks/useEducational";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: EducationalCategory[];
  onAddCategory: (name: string) => Promise<EducationalCategory | null>;
  onSubmit: (values: { name: string; category_id: string | null; youtube_url?: string | null; video_url?: string | null; responsible_id: string; material_link?: string | null }) => Promise<boolean>;
}

export function AddContentDialog({ open, onOpenChange, categories, onAddCategory, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [source, setSource] = useState<"youtube" | "upload">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [responsibleId, setResponsibleId] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [materialLink, setMaterialLink] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("profiles").select("id, full_name").order("full_name").then(({ data }) => {
        if (data) setProfiles(data);
      });
    }
  }, [open]);

  const reset = () => {
    setName(""); setCategoryId(""); setYoutubeUrl(""); setResponsibleId("");
    setMaterialLink(""); setShowNewCat(false); setNewCatName("");
    setSource("youtube"); setFile(null);
  };

  const canSave = !!name.trim() && !!responsibleId && (source === "youtube" ? !!youtubeUrl.trim() : !!file);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    let video_url: string | null = null;
    let youtube_url: string | null = null;
    if (source === "upload" && file) {
      setUploading(true);
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `educacional/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("swipe-videos").upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      setUploading(false);
      if (upErr) { toast.error("Erro ao enviar o vídeo: " + upErr.message); setSaving(false); return; }
      video_url = supabase.storage.from("swipe-videos").getPublicUrl(path).data.publicUrl;
    } else {
      youtube_url = youtubeUrl.trim();
    }
    const ok = await onSubmit({
      name: name.trim(),
      category_id: categoryId || null,
      youtube_url,
      video_url,
      responsible_id: responsibleId,
      material_link: materialLink.trim() || null,
    });
    setSaving(false);
    if (ok) { reset(); onOpenChange(false); }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const cat = await onAddCategory(newCatName.trim());
    if (cat) { setCategoryId(cat.id); setShowNewCat(false); setNewCatName(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="glass border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Adicionar Conteúdo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-2xs">Nome do conteúdo</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="Ex: Aula de Copy" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-2xs">Categoria</Label>
              <button onClick={() => setShowNewCat(!showNewCat)} className="text-primary hover:text-primary/80 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {showNewCat && (
              <div className="flex gap-2">
                <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50 flex-1" placeholder="Nova categoria" onKeyDown={e => e.key === "Enter" && handleAddCategory()} />
                <button onClick={handleAddCategory} className="px-3 py-1 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">OK</button>
              </div>
            )}
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-2xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Aula (vídeo)</Label>
            <div className="flex gap-1 rounded-md bg-secondary/30 p-0.5">
              <button type="button" onClick={() => setSource("youtube")} className={cn("flex-1 rounded px-2 py-1 text-2xs transition-colors", source === "youtube" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Link do YouTube</button>
              <button type="button" onClick={() => setSource("upload")} className={cn("flex-1 rounded px-2 py-1 text-2xs transition-colors", source === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Do computador</button>
            </div>
            {source === "youtube" ? (
              <Input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="https://youtube.com/watch?v=..." />
            ) : (
              <>
                <input id="edu-file" type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <label htmlFor="edu-file" className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border/50 bg-secondary/30 px-2.5 text-2xs text-muted-foreground hover:bg-secondary/50">
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{file ? file.name : "Escolher vídeo (mp4, até 1 GB)"}</span>
                </label>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Link do material (opcional)</Label>
            <Input value={materialLink} onChange={e => setMaterialLink(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="https://..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Responsável</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-2xs">{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { reset(); onOpenChange(false); }} className="px-3 py-1.5 text-2xs rounded-md text-muted-foreground hover:bg-secondary/60 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={!canSave || saving} className="px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {uploading ? "Enviando vídeo..." : saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
