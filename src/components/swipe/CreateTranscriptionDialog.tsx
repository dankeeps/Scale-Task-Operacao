import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Film, X, Loader2, Captions } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TranscriptSegment } from "@/hooks/useSwipeTranscriptions";
import type { CatalogItem, CatalogKind } from "@/hooks/useSwipeCatalogs";
import { CatalogSelect } from "@/components/swipe/CatalogSelect";

const MAX_MB = 1024; // 1 GB
const MAX_LABEL = "1 GB";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experts: CatalogItem[];
  offers: CatalogItem[];
  niches: CatalogItem[];
  languages: CatalogItem[];
  funnelTypes: CatalogItem[];
  onAddCatalog: (kind: CatalogKind, name: string) => Promise<CatalogItem | null>;
  onCreated: (row: {
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
  }) => Promise<boolean>;
}

type Stage = "idle" | "uploading" | "transcribing" | "saving";

// Reads duration AND grabs a poster frame from the video, in one pass.
function readVideoMeta(file: File): Promise<{ duration: number | null; thumbnail: Blob | null }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (duration: number | null, thumbnail: Blob | null, url?: string) => {
      if (settled) return;
      settled = true;
      if (url) URL.revokeObjectURL(url);
      resolve({ duration, thumbnail });
    };
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      (v as any).playsInline = true;
      let duration: number | null = null;

      v.onloadedmetadata = () => {
        duration = Number.isFinite(v.duration) ? v.duration : null;
        // seek to an early, non-black frame
        const target = Math.min(1, (v.duration || 2) / 2);
        try { v.currentTime = target; } catch { done(duration, null, url); }
      };
      v.onseeked = () => {
        try {
          const w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) return done(duration, null, url);
          const scale = w > 640 ? 640 / w : 1;
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) return done(duration, null, url);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => done(duration, blob, url), "image/jpeg", 0.8);
        } catch {
          done(duration, null, url);
        }
      };
      v.onerror = () => done(duration, null, url);
      // Safety timeout so a stubborn file never blocks submission
      setTimeout(() => done(duration, null, url), 8000);
      v.src = url;
    } catch {
      done(null, null);
    }
  });
}

export function CreateTranscriptionDialog({
  open, onOpenChange, experts, offers, niches, languages, funnelTypes, onAddCatalog, onCreated,
}: Props) {
  const [expertId, setExpertId] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [nicheId, setNicheId] = useState<string | null>(null);
  const [languageId, setLanguageId] = useState<string | null>(null);
  const [funnelTypeId, setFunnelTypeId] = useState<string | null>(null);
  const [adLibrary, setAdLibrary] = useState("");
  const [funnelLink, setFunnelLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = stage !== "idle";

  const reset = () => {
    setExpertId(null);
    setOfferId(null);
    setNicheId(null);
    setLanguageId(null);
    setFunnelTypeId(null);
    setAdLibrary("");
    setFunnelLink("");
    setFile(null);
    setStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Vídeo muito grande (máx ${MAX_LABEL}).`);
      return;
    }
    setFile(f);
  };

  const canSubmit = !!expertId && !!offerId && !!nicheId && !!languageId && !!file;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessão expirada."); return; }

    const offerName = offers.find((o) => o.id === offerId)?.name || "Sem nome";

    try {
      setStage("uploading");
      const { duration, thumbnail } = await readVideoMeta(file);
      const base = `${user.id}/${crypto.randomUUID()}`;
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${base}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("swipe-videos")
        .upload(path, file, { contentType: file.type || "video/mp4" });
      if (upErr) {
        console.error("Upload swipe-videos falhou:", upErr);
        const raw = (upErr as any)?.message || "";
        // Supabase returns 400/413 "exceeded the maximum allowed size" when the file
        // is over the bucket/global storage limit.
        const isSize = /maximum allowed size|payload too large|exceeded/i.test(raw);
        toast.error(
          isSize
            ? `Vídeo acima do limite do storage (${(file.size / 1024 / 1024).toFixed(0)} MB). Fale com o admin para aumentar o limite do bucket.`
            : `Erro ao enviar o vídeo: ${raw || "tente novamente"}`
        );
        setStage("idle");
        return;
      }
      const { data: urlData } = supabase.storage.from("swipe-videos").getPublicUrl(path);
      const videoUrl = urlData.publicUrl;

      // Upload the poster frame (best-effort — never blocks creation)
      let thumbnailUrl = "";
      if (thumbnail) {
        const thumbPath = `${base}.jpg`;
        const { error: thumbErr } = await supabase.storage
          .from("swipe-videos")
          .upload(thumbPath, thumbnail, { contentType: "image/jpeg" });
        if (!thumbErr) {
          thumbnailUrl = supabase.storage.from("swipe-videos").getPublicUrl(thumbPath).data.publicUrl;
        }
      }

      setStage("transcribing");
      const { data, error } = await supabase.functions.invoke("transcribe-video", {
        body: { videoUrl, mimeType: file.type || undefined },
      });
      if (error || (data as any)?.error) {
        let msg = (data as any)?.error || error?.message || "Falha na transcrição.";
        // supabase-js hides the function's real error inside error.context (the raw
        // Response). Pull it out so we see the actual reason instead of the generic
        // "Edge Function returned a non-2xx status code".
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const bodyText = await ctx.text();
            try {
              const j = JSON.parse(bodyText);
              if (j?.error) msg = j.error;
            } catch {
              if (bodyText) msg = bodyText;
            }
          } catch { /* ignore */ }
          if (ctx.status) msg += ` (status ${ctx.status})`;
        }
        console.error("transcribe-video falhou:", msg, error);
        toast.error(String(msg).slice(0, 220));
        await supabase.storage.from("swipe-videos").remove([path]).catch(() => {});
        setStage("idle");
        return;
      }
      const segments: TranscriptSegment[] = Array.isArray((data as any)?.segments)
        ? (data as any).segments
        : [];
      if (segments.length === 0) {
        toast.error("Nenhuma fala detectada no vídeo.");
        await supabase.storage.from("swipe-videos").remove([path]).catch(() => {});
        setStage("idle");
        return;
      }

      setStage("saving");
      const ok = await onCreated({
        title: offerName,
        video_url: videoUrl,
        duration,
        segments,
        expert_id: expertId,
        offer_id: offerId,
        niche_id: nicheId,
        language_id: languageId,
        funnel_type_id: funnelTypeId,
        ad_library_link: adLibrary.trim(),
        funnel_link: funnelLink.trim(),
        thumbnail_url: thumbnailUrl,
      });
      if (ok) {
        reset();
        onOpenChange(false);
      } else {
        setStage("idle");
      }
    } catch {
      toast.error("Erro inesperado ao criar a transcrição.");
      setStage("idle");
    }
  };

  const stageLabel =
    stage === "uploading" ? "Enviando vídeo..."
    : stage === "transcribing" ? "Transcrevendo com ElevenLabs... (pode levar alguns minutos)"
    : stage === "saving" ? "Salvando..."
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="glass border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Captions className="h-4 w-4 text-primary" />
            Criar Swipe por Transcrição
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <CatalogSelect
            label="Nome do Expert"
            required
            items={experts}
            value={expertId}
            onChange={setExpertId}
            onAdd={(name) => onAddCatalog("experts", name)}
            disabled={busy}
          />
          <CatalogSelect
            label="Nome da Oferta"
            required
            items={offers}
            value={offerId}
            onChange={setOfferId}
            onAdd={(name) => onAddCatalog("offers", name)}
            disabled={busy}
          />
          <div className="space-y-1">
            <Label className="text-2xs">Ad Library (link) <span className="text-muted-foreground">(opcional)</span></Label>
            <Input
              value={adLibrary}
              onChange={(e) => setAdLibrary(e.target.value)}
              disabled={busy}
              className="h-8 text-2xs bg-secondary/30 border-border/50"
              placeholder="https://facebook.com/ads/library/..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-2xs">Link do Funil <span className="text-muted-foreground">(opcional)</span></Label>
            <Input
              value={funnelLink}
              onChange={(e) => setFunnelLink(e.target.value)}
              disabled={busy}
              className="h-8 text-2xs bg-secondary/30 border-border/50"
              placeholder="https://..."
            />
          </div>
          <CatalogSelect
            label="Tipo de Funil"
            items={funnelTypes}
            value={funnelTypeId}
            onChange={setFunnelTypeId}
            onAdd={(name) => onAddCatalog("funnelTypes", name)}
            disabled={busy}
          />
          <CatalogSelect
            label="Nicho"
            required
            items={niches}
            value={nicheId}
            onChange={setNicheId}
            onAdd={(name) => onAddCatalog("niches", name)}
            disabled={busy}
          />
          <CatalogSelect
            label="Idioma"
            required
            items={languages}
            value={languageId}
            onChange={setLanguageId}
            onAdd={(name) => onAddCatalog("languages", name)}
            disabled={busy}
          />

          <div className="space-y-1">
            <Label className="text-2xs">Vídeo (máx {MAX_MB} MB)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFile}
              disabled={busy}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-border/50 bg-secondary/20 px-3 py-2">
                <Film className="h-4 w-4 text-primary shrink-0" />
                <span className="text-2xs text-foreground truncate flex-1">{file.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                {!busy && (
                  <button
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="w-full h-20 rounded-md border border-dashed border-border/50 bg-secondary/20 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
              >
                <Film className="h-5 w-5" />
                <span className="text-2xs">Clique aqui para subir vídeo</span>
              </button>
            )}
          </div>

          {busy && (
            <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-2xs text-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              {stageLabel}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={close}
              disabled={busy}
              className="px-3 py-1.5 text-2xs rounded-md text-muted-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || busy}
              className="px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {busy ? "Processando..." : "Transcrever"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
