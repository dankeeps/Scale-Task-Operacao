import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Puzzle, MousePointerClick, LogIn } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtensionDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-primary" />
            Extensão do Chrome
          </DialogTitle>
        </DialogHeader>

        <p className="text-2xs text-muted-foreground leading-relaxed">
          Instala um botão em cada anúncio da <b className="text-foreground">Biblioteca de Anúncios do Meta</b>.
          Ao clicar, você escolhe o workspace e informa oferta e expert — a data de início do anúncio
          (“Veiculação iniciada em…”) e os dias rodando são preenchidos automaticamente.
        </p>

        <a
          href="/scaletask-extension.zip"
          download
          className="flex items-center justify-center gap-2 h-10 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" />
          Baixar extensão (.zip)
        </a>

        <div className="space-y-2.5 mt-1">
          <p className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Como instalar</p>
          <ol className="space-y-2 text-2xs text-foreground/80">
            <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Descompacte o arquivo baixado.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Abra <code className="px-1 rounded bg-secondary/50">chrome://extensions</code> e ative o <b>Modo do desenvolvedor</b>.</li>
            <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Clique em <b>Carregar sem compactação</b> e selecione a pasta descompactada.</li>
            <li className="flex gap-2"><LogIn className="h-3.5 w-3.5 text-primary shrink-0 mt-px" /> Clique no ícone da extensão e faça login com sua conta.</li>
            <li className="flex gap-2"><MousePointerClick className="h-3.5 w-3.5 text-primary shrink-0 mt-px" /> Abra a Biblioteca de Anúncios do Meta — o botão <b>★ ScaleTask</b> aparece em cada anúncio.</li>
          </ol>
        </div>

        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Funciona apenas na Biblioteca de Anúncios do Meta. Você só grava em workspaces dos quais participa.
        </p>
      </DialogContent>
    </Dialog>
  );
}
