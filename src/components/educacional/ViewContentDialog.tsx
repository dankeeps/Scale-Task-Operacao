import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import type { EducationalContent } from "@/hooks/useEducational";

function getYoutubeEmbedUrl(url: string) {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1);
    }
    if (!videoId && u.pathname.includes("/embed/")) {
      videoId = u.pathname.split("/embed/")[1];
    }
    if (!videoId && u.pathname.includes("/shorts/")) {
      videoId = u.pathname.split("/shorts/")[1];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

interface Props {
  content: EducationalContent | null;
  onClose: () => void;
}

export function ViewContentDialog({ content, onClose }: Props) {
  if (!content) return null;
  const embedUrl = content.youtube_url ? getYoutubeEmbedUrl(content.youtube_url) : null;

  const copyShareLink = async () => {
    const url = `${window.location.origin}/dashboard/educacional?v=${content.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link da aula copiado! Envie para o time.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <Dialog open={!!content} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="glass border-border/50 sm:max-w-2xl">
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-2 pr-8">
            <DialogTitle className="truncate text-sm">{content.name}</DialogTitle>
            <button
              onClick={copyShareLink}
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1 text-2xs text-foreground transition-colors hover:bg-secondary/70"
              title="Copiar link para compartilhar esta aula"
            >
              <Link2 className="h-3.5 w-3.5" /> Copiar link
            </button>
          </div>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {content.video_url ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <video src={content.video_url} controls className="w-full h-full" />
            </div>
          ) : embedUrl ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={content.name}
              />
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-secondary/30 flex items-center justify-center text-muted-foreground text-2xs">
              Vídeo indisponível
            </div>
          )}
          <div className="flex items-center gap-4 text-2xs text-muted-foreground">
            {content.category && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{content.category.name}</span>
            )}
            {content.responsible && (
              <span>Responsável: <span className="text-foreground">{content.responsible.full_name}</span></span>
            )}
          </div>
          {content.material_link && (
            <a
              href={content.material_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Acessar material
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
