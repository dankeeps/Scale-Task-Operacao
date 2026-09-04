import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, RefreshCw, Loader2, Globe, KeyRound } from "lucide-react";
import { toast } from "sonner";

interface OwnedProject {
  id: string;
  name: string;
}

interface WebhookRow {
  id: string;
  metrics_webhook_token: string | null;
  metrics_webhook_domain: string | null;
}

const FN_PATH = "/functions/v1/ad-metrics-webhook";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Campos que o SaaS de tracking envia (rótulo -> chave do JSON).
const FIELD_REF: [string, string][] = [
  ["Nome do anúncio", "nome"],
  ["Hook Rate", "hook_rate"],
  ["Hold Rate", "hold_rate"],
  ["CPM", "cpm"],
  ["Conv. Checkout", "conv_checkout"],
  ["Custo IC", "custo_ic"],
  ["CPC", "cpc"],
  ["Retenção p/ 1min", "retencao_1min"],
  ["Retenção ao Pitch", "retencao_pitch"],
  ["Conversão da VSL", "conversao_vsl"],
  ["Faturamento", "faturamento"],
  ["Investimento", "investimento"],
  ["ROAS", "roas"],
  ["Faturamento Backend", "faturamento_backend"],
];

function buildUrl(domain: string | null, token: string | null) {
  const base = domain
    ? `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}${FN_PATH}`
    : `${SUPABASE_URL}${FN_PATH}`;
  return `${base}?token=${token ?? ""}`;
}

const EXAMPLE = `{
  "ads": [
    {
      "nome": "Nome exato do anúncio",
      "hook_rate": 32.5,
      "hold_rate": 18.2,
      "cpm": 24.90,
      "conv_checkout": 3.1,
      "custo_ic": 12.40,
      "cpc": 1.80,
      "retencao_1min": 41.0,
      "retencao_pitch": 22.7,
      "conversao_vsl": 8.4,
      "faturamento": 5230.00,
      "investimento": 1480.00,
      "roas": 3.53,
      "faturamento_backend": 1890.00
    }
  ]
}`;

export function WebhookPanel({ projects }: { projects: OwnedProject[] }) {
  const [rows, setRows] = useState<Record<string, WebhookRow>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [domainDraft, setDomainDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const ids = projects.map((p) => p.id);

  const fetchRows = useCallback(async () => {
    if (!ids.length) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("id, metrics_webhook_token, metrics_webhook_domain")
      .in("id", ids);
    if (error) { setLoading(false); return; }
    setRows(Object.fromEntries((data as WebhookRow[]).map((r) => [r.id, r])));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copiado!");
      setTimeout(() => setCopied(null), 1500);
    } catch { toast.error("Não foi possível copiar."); }
  };

  const regenerate = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    const newToken = crypto.randomUUID();
    const { error } = await (supabase as any)
      .from("projects").update({ metrics_webhook_token: newToken }).eq("id", id);
    setBusy((b) => ({ ...b, [id]: false }));
    if (error) { toast.error("Erro ao gerar novo token"); return; }
    setRows((r) => ({ ...r, [id]: { ...r[id], metrics_webhook_token: newToken } }));
    toast.success("Novo token gerado! Atualize a URL no seu SaaS.");
  };

  const saveDomain = async (id: string) => {
    const value = (domainDraft[id] ?? "").trim() || null;
    setBusy((b) => ({ ...b, [id]: true }));
    const { error } = await (supabase as any)
      .from("projects").update({ metrics_webhook_domain: value }).eq("id", id);
    setBusy((b) => ({ ...b, [id]: false }));
    if (error) { toast.error("Erro ao salvar domínio"); return; }
    setRows((r) => ({ ...r, [id]: { ...r[id], metrics_webhook_domain: value } }));
    setDomainDraft((d) => { const n = { ...d }; delete n[id]; return n; });
    toast.success("Domínio salvo!");
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Tabs defaultValue="endpoint" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="endpoint" className="flex-1 gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /> Endpoint</TabsTrigger>
        <TabsTrigger value="payload" className="flex-1 gap-1.5 text-xs"><KeyRound className="h-3.5 w-3.5" /> Exemplo de payload</TabsTrigger>
      </TabsList>

      {/* Endpoint por projeto */}
      <TabsContent value="endpoint" className="space-y-3 mt-4">
        <p className="text-2xs text-muted-foreground leading-relaxed">
          Cadastre esta URL no seu SaaS de tracking. Ele deve enviar (ex.: 1x/dia) um POST
          com as métricas de cada anúncio. Os dados são casados pelo <strong>nome do anúncio</strong> e
          atualizam as métricas do criativo automaticamente.
        </p>

        {projects.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Você não é dono de nenhum projeto.</p>
        )}

        {projects.map((p) => {
          const row = rows[p.id];
          const token = row?.metrics_webhook_token ?? null;
          const domain = row?.metrics_webhook_domain ?? null;
          const url = buildUrl(domain, token);
          const draft = domainDraft[p.id];
          const isBusy = !!busy[p.id];
          return (
            <div key={p.id} className="space-y-2.5 rounded-lg border border-border p-3">
              <h3 className="text-xs font-medium text-foreground">{p.name}</h3>

              {/* URL do webhook */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-medium">URL do webhook</span>
                <div className="flex gap-1.5">
                  <Input readOnly value={url} className="h-7 text-2xs bg-secondary/30 border-border/50 flex-1 font-mono" onFocus={(e) => e.target.select()} />
                  <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => copy(url, p.id)} title="Copiar URL">
                    {copied === p.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Domínio próprio (opcional) */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-medium">Domínio próprio (opcional)</span>
                <div className="flex gap-1.5">
                  <Input
                    value={draft ?? domain ?? ""}
                    onChange={(e) => setDomainDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                    placeholder="ex: meudominio.com"
                    className="h-7 text-2xs bg-secondary/30 border-border/50 flex-1"
                  />
                  {draft !== undefined && draft !== (domain ?? "") && (
                    <Button size="sm" className="h-7 text-2xs px-2 shrink-0" disabled={isBusy} onClick={() => saveDomain(p.id)}>Salvar</Button>
                  )}
                </div>
                {domain && (
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Configure seu domínio para apontar (proxy) para o Supabase:{" "}
                    <span className="font-mono break-all">{SUPABASE_URL}{FN_PATH}</span>. Enquanto não configurar, use a URL do Supabase.
                  </p>
                )}
              </div>

              {/* Regenerar token */}
              <div className="pt-1">
                <Button variant="ghost" size="sm" className="h-7 text-2xs gap-1.5 text-muted-foreground hover:text-foreground" disabled={isBusy} onClick={() => regenerate(p.id)}>
                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Gerar novo token (invalida o anterior)
                </Button>
              </div>
            </div>
          );
        })}
      </TabsContent>

      {/* Exemplo de payload */}
      <TabsContent value="payload" className="space-y-3 mt-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">Corpo do POST (application/json)</span>
            <Button size="sm" variant="ghost" className="h-6 text-2xs gap-1" onClick={() => copy(EXAMPLE, "example")}>
              {copied === "example" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
            </Button>
          </div>
          <pre className="rounded-md bg-secondary/40 border border-border/50 p-3 text-[11px] leading-relaxed overflow-x-auto font-mono text-foreground">{EXAMPLE}</pre>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Campos aceitos</span>
          <div className="rounded-md border border-border/50 overflow-hidden">
            {FIELD_REF.map(([label, key], i) => (
              <div key={key} className={`flex items-center justify-between px-2.5 py-1.5 text-2xs ${i % 2 ? "bg-secondary/20" : ""}`}>
                <span className="text-muted-foreground">{label}</span>
                <code className="font-mono text-foreground">{key}</code>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Envie <code className="font-mono">{"{ \"ads\": [ ... ] }"}</code> com um objeto por anúncio. O <strong>nome</strong> precisa
            bater com o nome cadastrado no anúncio (ignora maiúsculas/espaços). Aceita números
            ou texto (ex.: <code className="font-mono">"R$ 12,40"</code>, <code className="font-mono">"32,5"</code>). Campos ausentes são ignorados.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
