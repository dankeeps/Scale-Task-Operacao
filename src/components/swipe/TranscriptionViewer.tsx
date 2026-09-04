import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Check, ExternalLink, Link2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SwipeTranscription } from "@/hooks/useSwipeTranscriptions";

type Seg = { text: string; start: number; end: number };

interface Props {
  transcription: SwipeTranscription | null;
  onOpenChange: (open: boolean) => void;
}

// Viewer de transcrição: vídeo + transcrição sincronizada por tempo (o segmento
// ativo destaca e a lista rola sozinha; clicar num trecho pula o vídeo).
export function TranscriptionViewer({ transcription, onOpenChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedSegments, setSyncedSegments] = useState<Seg[] | null>(null);

  const segments: Seg[] = (syncedSegments ?? (transcription?.segments as Seg[] | undefined) ?? []);

  // Agrupa segmentos em parágrafos, quebrando só ao fim de frase.
  const paragraphs = useMemo(() => {
    const result: number[][] = [];
    let cur: number[] = [];
    segments.forEach((seg, i) => {
      cur.push(i);
      if (/[.!?…]$/.test((seg.text || "").trim())) { result.push(cur); cur = []; }
    });
    if (cur.length) result.push(cur);
    return result;
  }, [segments]);

  const activeIndex = useMemo(() => {
    if (!segments.length) return -1;
    let idx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (current >= segments[i].start - 0.05) idx = i; else break;
    }
    return idx;
  }, [current, segments]);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    listRef.current.querySelector<HTMLElement>(`[data-seg="${activeIndex}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  useEffect(() => { setCurrent(0); setSyncedSegments(null); }, [transcription?.id]);

  const seekTo = (t: number) => { const v = videoRef.current; if (!v) return; v.currentTime = t; v.play().catch(() => {}); };

  // Re-transcreve com ElevenLabs (word-level) p/ a legenda casar com o vídeo.
  const syncCaptions = async () => {
    if (!transcription) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-captions", { body: { transcriptionId: transcription.id } });
      const errMsg = error?.message || (data as { error?: string } | null)?.error;
      if (errMsg) { toast.error("Falha ao sincronizar: " + errMsg); return; }
      const segs = (data as { segments?: Seg[] } | null)?.segments;
      if (Array.isArray(segs)) { setSyncedSegments(segs); toast.success("Legenda sincronizada com o vídeo!"); }
    } finally {
      setSyncing(false);
    }
  };

  const copyShareLink = async () => {
    if (!transcription) return;
    const url = `${window.location.origin}/dashboard/swipe?v=${transcription.id}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copiado! Cole no WhatsApp para compartilhar com o time."); }
    catch { toast.error("Não foi possível copiar o link."); }
  };

  const copyAll = async () => {
    const text = paragraphs
      .map((para) => para.map((i) => segments[i].text).join(" ").replace(/\s+([,.;:!?])/g, "$1"))
      .join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); toast.success("Transcrição copiada!"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Não foi possível copiar."); }
  };

  const open = !!transcription;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 max-w-4xl overflow-hidden p-0">
        <DialogHeader className="px-4 pb-2 pt-4">
          <div className="flex min-w-0 items-center gap-2 pr-8">
            <DialogTitle className="truncate text-sm">{transcription?.title}</DialogTitle>
            {transcription?.ad_library_link && (
              <a href={transcription.ad_library_link} target="_blank" rel="noopener noreferrer"
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-primary" title="Abrir na Biblioteca de Anúncios">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button onClick={copyShareLink}
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1 text-2xs text-foreground transition-colors hover:bg-secondary/70"
              title="Copiar link para compartilhar">
              <Link2 className="h-3.5 w-3.5" /> Copiar link
            </button>
          </div>
        </DialogHeader>

        <div className="grid max-h-[75vh] gap-0 md:grid-cols-2">
          {/* Player */}
          <div className="flex items-center justify-center bg-black/40 p-3">
            {transcription && (
              <video ref={videoRef} src={transcription.video_url} controls
                className="max-h-[70vh] w-full rounded-md bg-black"
                onTimeUpdate={(e) => setCurrent((e.target as HTMLVideoElement).currentTime)} />
            )}
          </div>

          {/* Transcrição sincronizada */}
          <div className="flex min-h-0 flex-col border-l border-border/50">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2">
              <span className="text-2xs font-medium">Transcrição</span>
              <button onClick={copyAll} className="flex shrink-0 items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-primary" title="Copiar tudo">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            {transcription?.video_url && (
              <button onClick={syncCaptions} disabled={syncing}
                className="flex items-center justify-center gap-2 border-b border-border/50 bg-secondary/30 px-4 py-2 text-2xs font-semibold text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-60"
                title="Re-transcreve com ElevenLabs para a legenda casar exatamente com o vídeo">
                {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {syncing ? "Sincronizando…" : "SINCRONIZAR LEGENDA COM VÍDEO"}
              </button>
            )}
            <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {paragraphs.map((para, pi) => (
                <p key={pi} className="text-[15px] leading-relaxed">
                  {para.map((i) => {
                    const seg = segments[i];
                    const active = i === activeIndex;
                    return (
                      <span key={i}>
                        <span data-seg={i} onClick={() => seekTo(seg.start)}
                          className={active
                            ? "box-decoration-clone cursor-pointer rounded bg-amber-300 px-1 text-neutral-900"
                            : "cursor-pointer text-foreground/75 transition-colors hover:text-foreground"}>
                          {seg.text}
                        </span>{" "}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
