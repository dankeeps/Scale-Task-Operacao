// Helpers compartilhados do pipeline do Spy.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// Dispara a próxima etapa SEM esperar o processamento. A função-alvo retorna 202
// imediatamente (faz o trabalho pesado em EdgeRuntime.waitUntil), então este fetch
// resolve rápido — é o que evita a cascata de timeouts.
export async function invokeFn(fn: string, body: unknown): Promise<void> {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (_e) {
    /* best-effort */
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const nowISO = () => new Date().toISOString();

// URL de busca por palavra-chave na Biblioteca de Anúncios (formato usado pelo actor).
export function fbSearchUrl(keyword: string): string {
  const q = encodeURIComponent(keyword);
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&is_targeted_country=false&media_type=all&q=${q}&search_type=keyword_unordered&sort_data[direction]=desc&sort_data[mode]=total_impressions`;
}

// URL de todos os anúncios ativos de uma página (usada pelo Browserless).
export function pageAdsUrl(pageId: string): string {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&media_type=all&search_type=page&view_all_page_id=${encodeURIComponent(pageId)}`;
}

// Classifica um nº de anúncios ativos numa faixa. Retorna a key (low/medium/high) ou null.
export function classify(activeAds: number | null, ranges: any[]): string | null {
  if (activeAds == null) return null;
  const r = (ranges ?? []).find((x) => x.is_active && activeAds >= x.minimum_ads && activeAds <= x.maximum_ads);
  return r?.key ?? null;
}

const RUN_TERMINAL = ["done", "done_with_errors", "failed"];
export const isTerminal = (status: string) => RUN_TERMINAL.includes(status);
