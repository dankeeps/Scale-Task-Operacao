import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, X, Move } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    offer_name: string;
    library_link: string;
    site_url: string;
    active_ads_count: number;
    niche: string;
    spy_date: string | null;
    swipe_link: string;
    image_url: string;
    image_position: number;
  }) => void;
}

export function CreateSwipeDialog({ open, onOpenChange, onSubmit }: Props) {
  const [offerName, setOfferName] = useState("");
  const [libraryLink, setLibraryLink] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [activeAds, setActiveAds] = useState("");
  const [niche, setNiche] = useState("");
  const [spyDate, setSpyDate] = useState("");
  const [swipeLink, setSwipeLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setOfferName("");
    setLibraryLink("");
    setSiteUrl("");
    setActiveAds("");
    setNiche("");
    setSpyDate("");
    setSwipeLink("");
    setImageFile(null);
    setImagePreview(null);
    setImagePosition(50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePosition(50);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImagePosition(50);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const percent = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setImagePosition(percent);
  }, [isDragging]);

  const handleSubmit = async () => {
    if (!offerName.trim()) return;
    setUploading(true);

    let imageUrl = "";
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("swipe-images").upload(path, imageFile);
      if (error) {
        toast.error("Erro ao enviar imagem");
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("swipe-images").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    onSubmit({
      offer_name: offerName.trim(),
      library_link: libraryLink.trim(),
      site_url: siteUrl.trim(),
      active_ads_count: parseInt(activeAds) || 0,
      niche: niche.trim(),
      spy_date: spyDate || null,
      swipe_link: swipeLink.trim(),
      image_url: imageUrl,
      image_position: Math.round(imagePosition),
    });
    reset();
    setUploading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Criar Swipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-2xs">Imagem</Label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            {imagePreview ? (
              <div
                ref={containerRef}
                className="relative rounded-md overflow-hidden border border-border/50 bg-secondary/20 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={() => setIsDragging(true)}
                onMouseMove={handleDrag}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)}
                onTouchMove={handleDrag}
                onTouchEnd={() => setIsDragging(false)}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                  style={{ objectPosition: `center ${imagePosition}%` }}
                  draggable={false}
                />
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-background/70 text-muted-foreground text-[10px]">
                  <Move className="h-3 w-3" />
                  Arraste para reposicionar
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeImage(); }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 rounded-md border border-dashed border-border/50 bg-secondary/20 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-2xs">Clique para selecionar</span>
              </button>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-2xs">Nome da oferta</Label>
            <Input value={offerName} onChange={(e) => setOfferName(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="Ex: Produto X" />
          </div>
          <div className="space-y-1">
            <Label className="text-2xs">Link da biblioteca</Label>
            <Input value={libraryLink} onChange={(e) => setLibraryLink(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label className="text-2xs">URL do site</Label>
            <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-2xs">Quantidade de anúncios ativos</Label>
              <Input type="number" value={activeAds} onChange={(e) => setActiveAds(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-2xs">Data do spy</Label>
              <Input type="date" value={spyDate} onChange={(e) => setSpyDate(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-2xs">Nicho</Label>
            <Input value={niche} onChange={(e) => setNiche(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="Ex: Saúde" />
          </div>
          <div className="space-y-1">
            <Label className="text-2xs">Link do swipe</Label>
            <Input value={swipeLink} onChange={(e) => setSwipeLink(e.target.value)} className="h-8 text-2xs bg-secondary/30 border-border/50" placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onOpenChange(false)} className="px-3 py-1.5 text-2xs rounded-md text-muted-foreground hover:bg-secondary/60 transition-colors">Cancelar</button>
            <button onClick={handleSubmit} disabled={!offerName.trim() || uploading} className="px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {uploading ? "Enviando..." : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
