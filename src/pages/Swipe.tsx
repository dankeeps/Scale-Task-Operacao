import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ExternalLink, Trash2, FileText, Clock, Captions, Play, Filter, Puzzle, Pencil, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSwipes, SwipeHistory } from "@/hooks/useSwipes";
import { useSwipeTranscriptions, SwipeTranscription } from "@/hooks/useSwipeTranscriptions";
import { useSwipeCatalogs, CatalogItem } from "@/hooks/useSwipeCatalogs";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { CreateSwipeDialog } from "@/components/swipe/CreateSwipeDialog";
import { CreateTranscriptionDialog } from "@/components/swipe/CreateTranscriptionDialog";
import { TranscriptionViewer } from "@/components/swipe/TranscriptionViewer";
import { ExtensionDialog } from "@/components/swipe/ExtensionDialog";
import { EditTranscriptionDialog } from "@/components/swipe/EditTranscriptionDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const INNER_TABS = [
  { k: "swipes", l: "Swipes" },
] as const;
type InnerTab = (typeof INNER_TABS)[number]["k"];

function FilterSelect({ label, items, value, onChange }: {
  label: string;
  items: CatalogItem[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? null : v)}>
      <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50 w-36">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-2xs">{label}: todos</SelectItem>
        {items.map((it) => (
          <SelectItem key={it.id} value={it.id} className="text-2xs">{it.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const Swipe = () => {
  const { canCreateSwipe } = useCurrentUserRole();
  const { swipes, loading, addSwipe, deleteSwipe, updateSwipe, fetchHistory } = useSwipes();
  const { transcriptions, addTranscription, updateTranscription, deleteTranscription } = useSwipeTranscriptions();
  const { experts, offers, niches, languages, funnelTypes, addItem } = useSwipeCatalogs();
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [showExtension, setShowExtension] = useState(false);
  const [viewing, setViewing] = useState<SwipeTranscription | null>(null);
  const [editing, setEditing] = useState<SwipeTranscription | null>(null);
  const [innerTab, setInnerTab] = useState<InnerTab>("swipes");
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link: /dashboard/swipe?v=<id> opens that swipe directly (shareable link).
  useEffect(() => {
    const vid = searchParams.get("v");
    if (!vid || viewing?.id === vid) return;
    const t = transcriptions.find((x) => x.id === vid);
    if (t) setViewing(t);
  }, [searchParams, transcriptions, viewing?.id]);

  // Open a swipe and reflect it in the URL so the link can be copied/shared.
  const openViewer = (t: SwipeTranscription) => {
    setViewing(t);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("v", t.id);
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
  const [fExpert, setFExpert] = useState<string | null>(null);
  const [fOffer, setFOffer] = useState<string | null>(null);
  const [fFunnel, setFFunnel] = useState<string | null>(null);
  const [fNiche, setFNiche] = useState<string | null>(null);
  const [fLang, setFLang] = useState<string | null>(null);

  const hasFilter = !!(fExpert || fOffer || fFunnel || fNiche || fLang);
  const clearFilters = () => { setFExpert(null); setFOffer(null); setFFunnel(null); setFNiche(null); setFLang(null); };
  const filteredTranscriptions = transcriptions.filter((t) =>
    (!fExpert || t.expert_id === fExpert) &&
    (!fOffer || t.offer_id === fOffer) &&
    (!fFunnel || t.funnel_type_id === fFunnel) &&
    (!fNiche || t.niche_id === fNiche) &&
    (!fLang || t.language_id === fLang)
  );

  const nameOf = (items: CatalogItem[], id: string | null) =>
    id ? items.find((i) => i.id === id)?.name : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Swipe</h1>
          <p className="text-2xs text-muted-foreground">Biblioteca de swipes e referências</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateSwipe && (
            <>
              <button
                onClick={() => setShowExtension(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-2xs rounded-md border border-border/60 bg-secondary/40 text-foreground hover:bg-secondary/70 transition-colors"
              >
                <Puzzle className="h-3.5 w-3.5" />
                Extensão
              </button>
              <button
                onClick={() => setShowTranscribe(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Captions className="h-3.5 w-3.5" />
                Criar Swipe por Transcrição
              </button>
            </>
          )}
        </div>
      </div>

      {INNER_TABS.length > 1 && (
        <div className="flex gap-1 border-b border-border/50">
          {INNER_TABS.map((it) => (
            <button key={it.k} onClick={() => setInnerTab(it.k)}
              className={cn("border-b-2 px-3 py-2 text-2xs font-medium transition-colors", innerTab === it.k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {it.l}
            </button>
          ))}
        </div>
      )}

      {innerTab === "swipes" && (
      <>
      {transcriptions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Por transcrição</h2>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect label="Expert" items={experts} value={fExpert} onChange={setFExpert} />
              <FilterSelect label="Oferta" items={offers} value={fOffer} onChange={setFOffer} />
              <FilterSelect label="Tipo de funil" items={funnelTypes} value={fFunnel} onChange={setFFunnel} />
              <FilterSelect label="Nicho" items={niches} value={fNiche} onChange={setFNiche} />
              <FilterSelect label="Idioma" items={languages} value={fLang} onChange={setFLang} />
              {hasFilter && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 h-8 text-2xs rounded-md text-muted-foreground hover:bg-secondary/60 transition-colors"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>
          </div>
          {filteredTranscriptions.length === 0 ? (
            <p className="text-2xs text-muted-foreground py-4">Nenhum swipe com esses filtros.</p>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTranscriptions.map((t) => {
              const offerName = nameOf(offers, t.offer_id) || t.title;
              const expertName = nameOf(experts, t.expert_id);
              const nicheName = nameOf(niches, t.niche_id);
              const languageName = nameOf(languages, t.language_id);
              const funnelTypeName = nameOf(funnelTypes, t.funnel_type_id);
              const meta = [expertName, nicheName, languageName, funnelTypeName].filter(Boolean).join(" · ");
              return (
              <div
                key={t.id}
                onClick={() => openViewer(t)}
                className="group cursor-pointer rounded-lg surface surface-hover shadow-sm dark:shadow-none overflow-hidden transition-all hover:shadow-md"
              >
                <div className="relative w-full h-32 bg-secondary/30">
                  {t.thumbnail_url ? (
                    <img src={t.thumbnail_url} alt={offerName} className="w-full h-full object-cover" />
                  ) : t.video_url ? (
                    <video
                      src={`${t.video_url}#t=0.5`}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-10 w-10 rounded-full bg-black/55 flex items-center justify-center">
                      <Play className="h-5 w-5 text-white fill-white" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-xs font-medium text-foreground truncate">{offerName}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.funnel_link && (
                      <a
                        href={t.funnel_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary transition-all"
                        title="Abrir funil"
                      >
                        <Filter className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {t.ad_library_link && (
                      <a
                        href={t.ad_library_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary transition-all"
                        title="Abrir Ad Library"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(t); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-primary transition-all"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass border-border/50" onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-sm">Excluir transcrição?</AlertDialogTitle>
                          <AlertDialogDescription className="text-2xs">
                            "{offerName}" e o vídeo enviado serão excluídos permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="text-2xs h-7">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTranscription(t)}
                            className="text-2xs h-7 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {meta && <p className="mt-2 text-2xs text-muted-foreground truncate">{meta}</p>}
                {t.days_running != null && (
                  <p className="mt-2 flex items-center gap-1 text-2xs text-muted-foreground/70">
                    <Clock className="h-3 w-3" /> Rodando há {t.days_running} dia(s)
                  </p>
                )}
                {t.creator_name && (
                  <p className="mt-1 text-2xs text-muted-foreground/70 truncate">Criado por {t.creator_name}</p>
                )}
                </div>
              </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : swipes.length === 0 && transcriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhum swipe criado</p>
          <p className="text-2xs">Clique em "Criar Swipe" para começar</p>
        </div>
      ) : swipes.length === 0 ? null : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {swipes.map((swipe) => (
            <div
              key={swipe.id}
              className="group rounded-lg surface surface-hover shadow-sm dark:shadow-none overflow-hidden transition-all hover:shadow-md"
            >
              {swipe.image_url && (
                <div className="w-full h-32 bg-secondary/20">
                  <img src={swipe.image_url} alt={swipe.offer_name} className="w-full h-full object-cover" style={{ objectPosition: `center ${swipe.image_position ?? 50}%` }} onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
                </div>
              )}
              <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-medium text-foreground truncate flex-1">
                  {swipe.offer_name}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  {swipe.library_link && (
                    <a
                      href={swipe.library_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                      title="Abrir biblioteca"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass border-border/50">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Excluir swipe?</AlertDialogTitle>
                        <AlertDialogDescription className="text-2xs">
                          O swipe "{swipe.offer_name}" será excluído permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="text-2xs h-7">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteSwipe(swipe.id)}
                          className="text-2xs h-7 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {swipe.niche && (
                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-2xs">
                    {swipe.niche}
                  </span>
                )}
                <span className="text-2xs text-muted-foreground">
                  {swipe.active_ads_count} anúncios
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                {swipe.swipe_link ? (
                  <a
                    href={swipe.swipe_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-2xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver swipe
                  </a>
                ) : <span />}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                      title="Atualizar spy"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 space-y-3" align="end">
                    <UpdateSpyForm
                      swipeId={swipe.id}
                      initialCount={swipe.active_ads_count}
                      initialDate={swipe.spy_date}
                      onSave={(count, date) => updateSwipe(swipe.id, { active_ads_count: count, spy_date: date })}
                      fetchHistory={fetchHistory}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      <CreateTranscriptionDialog
        open={showTranscribe}
        onOpenChange={setShowTranscribe}
        experts={experts}
        offers={offers}
        niches={niches}
        languages={languages}
        funnelTypes={funnelTypes}
        onAddCatalog={addItem}
        onCreated={addTranscription}
      />
      <TranscriptionViewer transcription={viewing} onOpenChange={(o) => { if (!o) closeViewer(); }} />
      <ExtensionDialog open={showExtension} onOpenChange={setShowExtension} />
      <EditTranscriptionDialog
        transcription={editing}
        experts={experts}
        offers={offers}
        niches={niches}
        languages={languages}
        funnelTypes={funnelTypes}
        onAddCatalog={addItem}
        onSave={updateTranscription}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />
    </div>
  );
};

function UpdateSpyForm({ swipeId, initialCount, initialDate, onSave, fetchHistory }: {
  swipeId: string;
  initialCount: number;
  initialDate: string | null;
  onSave: (count: number, date: string | null) => void;
  fetchHistory: (swipeId: string) => Promise<SwipeHistory[]>;
}) {
  const [count, setCount] = useState(String(initialCount));
  const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
  const [history, setHistory] = useState<SwipeHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    setLoadingHistory(true);
    fetchHistory(swipeId).then((h) => {
      setHistory(h);
      setLoadingHistory(false);
    });
  }, [swipeId]);

  const handleSave = async () => {
    await onSave(parseInt(count) || 0, date || null);
    const h = await fetchHistory(swipeId);
    setHistory(h);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-2xs">Anúncios ativos</Label>
          <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="h-7 text-2xs bg-secondary/30 border-border/50" />
        </div>
        <div className="space-y-1">
          <Label className="text-2xs">Data da verificação</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-2xs bg-secondary/30 border-border/50" />
        </div>
        <button
          onClick={handleSave}
          className="w-full px-2 py-1 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Atualizar
        </button>
      </div>

      <Separator />

      <div className="space-y-1">
        <Label className="text-2xs text-muted-foreground">Histórico</Label>
        {loadingHistory ? (
          <p className="text-2xs text-muted-foreground">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-2xs text-muted-foreground italic">Nenhuma atualização ainda</p>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-2xs px-2 py-1.5 rounded bg-secondary/30">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{h.active_ads_count} anúncios</span>
                  {h.spy_date && (
                    <span className="text-muted-foreground">
                      Spy: {format(new Date(h.spy_date + "T00:00:00"), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground text-[10px]">
                  {format(new Date(h.created_at), "dd/MM HH:mm")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Swipe;
