import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  enviado_gravacao: "Enviado para gravação",
  enviado_analise_1: "Enviado para análise 1",
  enviado_edicao: "Enviado para edição",
  enviado_analise_2: "Enviado para análise 2",
  enviado_subir: "Enviado para subir",
  no_ar: "No Ar",
};

interface Ad {
  id: string;
  name: string;
  briefing?: string | null;
  status: string;
  copywriter_id: string | null;
  formato_id: string | null;
  avatar_id?: string | null;
  copy_method_id?: string | null;
  referencia?: string | null;
  notas_editor?: string | null;
  notas_gravacao?: string | null;
  texto?: string | null;
  validacao: boolean;
  hook_rate: number | null;
  hold_rate: number | null;
  cpm: number | null;
  conv_checkout: number | null;
  cic: number | null;
  cpc: number | null;
  retencao_1min?: number | null;
  retencao_pitch?: number | null;
  conversao_vsl?: number | null;
  faturamento?: number | null;
  investimento?: number | null;
  roas?: number | null;
  faturamento_backend?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remessaName?: string;
  link?: string;
  createdAt: string;
  ads: Ad[];
  formatoMap: Record<string, string>;
  avatarMap: Record<string, string>;
  copyMethodMap: Record<string, string>;
  memberMap: Record<string, string>;
}

export function ViewDocumentDialog({ open, onOpenChange, remessaName, link, createdAt, ads, formatoMap, avatarMap, copyMethodMap, memberMap }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-popover sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <span>{remessaName || "Sem remessa"}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {new Date(createdAt).toLocaleDateString("pt-BR")}
            </span>
          </DialogTitle>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-fit" title={link}>
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir pasta
            </a>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-1">
          <div className="space-y-6 pb-4 px-1">
            {ads.map((ad, i) => (
              <div key={ad.id} className="rounded-lg bg-white/[0.04] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {ad.name || `Anúncio ${i + 1}`}
                  </h3>
                  <Badge variant={ad.status === "no_ar" ? "default" : "outline"}>
                    {STATUS_LABELS[ad.status] ?? ad.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                  <Field label="Copywriter" value={ad.copywriter_id ? (memberMap[ad.copywriter_id] ?? ad.copywriter_id.slice(0, 8)) : "—"} />
                  <Field label="Formato" value={ad.formato_id ? (formatoMap[ad.formato_id] ?? "—") : "—"} />
                  <Field label="Avatar" value={ad.avatar_id ? (avatarMap[ad.avatar_id] ?? "—") : "—"} />
                  <Field label="Método de Copy" value={ad.copy_method_id ? (copyMethodMap[ad.copy_method_id] ?? "—") : "—"} />
                  <Field label="Validação" value={ad.validacao ? "Sim" : "Não"} />
                  {ad.referencia ? (
                    <div>
                      <span className="text-xs text-muted-foreground">Referência</span>
                      <p className="text-sm font-medium">
                        <a href={ad.referencia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </a>
                      </p>
                    </div>
                  ) : (
                    <Field label="Referência" value="—" />
                  )}
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm border-t border-border/60 pt-3">
                  <Field label="Hook Rate" value={ad.hook_rate !== null ? `${ad.hook_rate}%` : "—"} />
                  <Field label="Hold Rate" value={ad.hold_rate !== null ? `${ad.hold_rate}%` : "—"} />
                  <Field label="CPM" value={ad.cpm !== null ? `R$ ${ad.cpm}` : "—"} />
                  <Field label="Conv. Checkout" value={ad.conv_checkout !== null ? `${ad.conv_checkout}%` : "—"} />
                  <Field label="Custo IC" value={ad.cic !== null ? `R$ ${ad.cic}` : "—"} />
                  <Field label="CPC" value={ad.cpc !== null ? `R$ ${ad.cpc}` : "—"} />
                  <Field label="Retenção p/ 1min" value={ad.retencao_1min != null ? `${ad.retencao_1min}%` : "—"} />
                  <Field label="Retenção ao Pitch" value={ad.retencao_pitch != null ? `${ad.retencao_pitch}%` : "—"} />
                  <Field label="Conversão da VSL" value={ad.conversao_vsl != null ? `${ad.conversao_vsl}%` : "—"} />
                  <Field label="Faturamento" value={ad.faturamento != null ? `R$ ${ad.faturamento}` : "—"} />
                  <Field label="Investimento" value={ad.investimento != null ? `R$ ${ad.investimento}` : "—"} />
                  <Field label="ROAS" value={ad.roas != null ? `${ad.roas}` : "—"} />
                  <Field label="Faturamento Backend" value={ad.faturamento_backend != null ? `R$ ${ad.faturamento_backend}` : "—"} />
                </div>

                {/* Blocos de texto */}
                {ad.briefing && <TextBlock label="Briefing" text={ad.briefing} />}
                {ad.texto && <TextBlock label="Copy do anúncio" text={ad.texto} />}
                {ad.notas_editor && <TextBlock label="Notas para editor" text={ad.notas_editor} />}
                {ad.notas_gravacao && <TextBlock label="Notas para gravação" text={ad.notas_gravacao} />}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mt-2">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
