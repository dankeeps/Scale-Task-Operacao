import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Play, Trash2, Search, FileText } from "lucide-react";
import { useEducational, type EducationalContent } from "@/hooks/useEducational";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddContentDialog } from "@/components/educacional/AddContentDialog";
import { ViewContentDialog } from "@/components/educacional/ViewContentDialog";

function getYoutubeThumbnail(url: string) {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get("v");
    if (!videoId && u.hostname === "youtu.be") videoId = u.pathname.slice(1);
    if (!videoId && u.pathname.includes("/shorts/")) videoId = u.pathname.split("/shorts/")[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  } catch {
    return null;
  }
}

const Educacional = () => {
  const { content, categories, loading, addCategory, addContent, deleteContent } = useEducational();
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState<EducationalContent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link: /dashboard/educacional?v=<id> abre a aula direto (link compartilhável).
  useEffect(() => {
    const vid = searchParams.get("v");
    if (!vid || viewing?.id === vid) return;
    const item = content.find((x) => x.id === vid);
    if (item) setViewing(item);
  }, [searchParams, content, viewing?.id]);

  // Abre a aula e reflete na URL para o link poder ser copiado/compartilhado.
  const openViewer = (item: EducationalContent) => {
    setViewing(item);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("v", item.id);
      return p;
    });
  };
  const closeViewer = () => {
    setViewing(null);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete("v");
      return p;
    }, { replace: true });
  };

  const authors = useMemo(() => {
    const map = new Map<string, string>();
    content.forEach((c) => {
      if (c.responsible) map.set(c.responsible_id, c.responsible.full_name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [content]);

  const filtered = useMemo(() => {
    return content.filter((item) => {
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      if (authorFilter !== "all" && item.responsible_id !== authorFilter) return false;
      return true;
    });
  }, [content, searchQuery, categoryFilter, authorFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Educacional</h1>
          <p className="text-2xs text-muted-foreground">Conteúdos de aprendizagem da equipe</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar conteúdo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conteúdo..."
            className="h-8 text-2xs pl-8 bg-secondary/30 border-border/50"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-[160px] text-2xs bg-secondary/30 border-border/50">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-2xs">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-2xs">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={authorFilter} onValueChange={setAuthorFilter}>
          <SelectTrigger className="h-8 w-[160px] text-2xs bg-secondary/30 border-border/50">
            <SelectValue placeholder="Autor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-2xs">Todos autores</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-2xs">{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Play className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhum conteúdo encontrado</p>
          <p className="text-2xs">Tente alterar os filtros ou adicione conteúdo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const thumb = item.youtube_url ? getYoutubeThumbnail(item.youtube_url) : null;
            return (
              <div
                key={item.id}
                className="group rounded-lg border border-border/50 bg-card/50 overflow-hidden cursor-pointer hover:border-primary/30 transition-all hover:shadow-md"
                onClick={() => openViewer(item)}
              >
                <div className="relative aspect-video bg-secondary/30">
                  {item.video_url ? (
                    <video src={`${item.video_url}#t=0.5`} muted preload="metadata" className="w-full h-full object-cover" />
                  ) : thumb ? (
                    <img src={thumb} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <h3 className="text-xs font-medium text-foreground truncate">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-2xs text-muted-foreground min-w-0">
                      {item.category && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary truncate">{item.category.name}</span>
                      )}
                      {item.responsible && (
                        <span className="truncate">{item.responsible.full_name}</span>
                      )}
                      {item.material_link && (
                        <span title="Possui material" className="text-primary"><FileText className="h-3 w-3" /></span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteContent(item.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddContentDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        categories={categories}
        onAddCategory={addCategory}
        onSubmit={addContent}
      />
      <ViewContentDialog content={viewing} onClose={closeViewer} />
    </div>
  );
};

export default Educacional;
