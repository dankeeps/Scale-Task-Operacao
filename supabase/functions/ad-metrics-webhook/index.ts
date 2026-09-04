// Webhook de métricas: recebe do SaaS de tracking (1x/dia) as métricas de cada
// anúncio e atualiza os creative_ads casando pelo NOME do anúncio, dentro do
// projeto identificado pelo token (query ?token= ou header x-webhook-token).
//
// Autenticado só pelo token do projeto — sem JWT (verify_jwt = false).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Lê o primeiro alias presente no objeto.
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

// Converte número aceitando formatos BR ("R$ 12,40", "32,5", "1.234,56", 12.4).
function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  let s = String(v).trim().replace(/[R$%\s]/gi, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Mapeia uma entrada do payload -> { name, campos numéricos presentes }.
function parseEntry(raw: Record<string, unknown>) {
  // Índice case-insensitive do objeto recebido (chaves em minúsculas).
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) lower[k.toLowerCase()] = raw[k];

  const name = pick(lower, ["nome", "name", "ad_name", "nome_do_anuncio", "anuncio", "ad"]);
  const fields: Record<string, number> = {};
  const map: Record<string, string[]> = {
    hook_rate: ["hook_rate", "hookrate", "hook"],
    hold_rate: ["hold_rate", "holdrate", "hold"],
    cpm: ["cpm"],
    conv_checkout: ["conv_checkout", "convcheckout", "conversao_checkout", "conv"],
    cic: ["cic", "custo_ic", "custoic", "custo_inicio_checkout"],
    cpc: ["cpc"],
    retencao_1min: ["retencao_1min", "retencao1min", "retencao_p_1min", "retention_1min", "ret_1min"],
    retencao_pitch: ["retencao_pitch", "retencaopitch", "retencao_ao_pitch", "retention_pitch", "ret_pitch"],
    conversao_vsl: ["conversao_vsl", "conversaovsl", "conv_vsl", "conversion_vsl", "vsl_conversao"],
    faturamento: ["faturamento", "revenue", "receita", "faturamento_front", "receita_front"],
    investimento: ["investimento", "investment", "spend", "gasto", "ad_spend"],
    roas: ["roas"],
    faturamento_backend: ["faturamento_backend", "backend_revenue", "receita_backend", "faturamento_back", "revenue_backend"],
  };
  for (const [col, aliases] of Object.entries(map)) {
    const n = toNum(pick(lower, aliases));
    if (n !== undefined) fields[col] = n;
  }
  return { name, fields };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("token") || req.headers.get("x-webhook-token") || "").trim();
    if (!token) return json({ error: "token ausente (use ?token= ou header x-webhook-token)" }, 401);

    const { data: project } = await service
      .from("projects").select("id").eq("metrics_webhook_token", token).maybeSingle();
    if (!project) return json({ error: "token inválido" }, 401);

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "JSON inválido" }, 400);
    // Aceita { ads: [...] }, array direto, ou objeto único.
    const list: Record<string, unknown>[] = Array.isArray(body)
      ? body
      : Array.isArray((body as any).ads) ? (body as any).ads
      : [body];
    if (!list.length) return json({ error: "nenhum anúncio no payload" }, 400);

    // Índice nome-normalizado -> ids dos anúncios do projeto.
    const { data: ads } = await service
      .from("creative_ads").select("id, name").eq("project_id", project.id);
    const byName = new Map<string, string[]>();
    for (const a of ads ?? []) {
      const key = norm(a.name);
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), a.id]);
    }

    let updated = 0;
    const notFound: string[] = [];
    for (const raw of list) {
      const { name, fields } = parseEntry(raw);
      const key = norm(name);
      if (!key) continue;
      const ids = byName.get(key);
      if (!ids || !ids.length) { notFound.push(String(name)); continue; }
      if (!Object.keys(fields).length) continue;
      const { error } = await service.from("creative_ads").update(fields).in("id", ids);
      if (!error) updated += ids.length;
    }

    return json({ ok: true, received: list.length, updated, notFound });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
