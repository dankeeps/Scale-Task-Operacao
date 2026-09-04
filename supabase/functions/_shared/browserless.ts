// Lógica compartilhada de scraping da FB Ad Library via Browserless.
// Usada por spy-process-page (fase de páginas) e spy-monitor-favorites (monitoramento).
//
// Armadilhas já resolvidas (não regrida):
//  - só o endpoint /function aceita { code, context }; a raiz devolve 404.
//  - Browserless mata a request em ~30s por padrão → passamos &timeout=.
//  - networkidle2 + settle curto (domcontentloaded+waitForFunction estourava o limite).
//  - página com 1 anúncio mostra "~1 result" (singular) → regex results?/resultados?.

export const BROWSERLESS_SCRIPT = `export default async function ({ page, context }) {
  const url = context.url;
  const out = { matchedText: null };
  try { await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 }); } catch (e) {}
  try {
    await page.waitForFunction(
      () => /~?\\s*[\\d.,]+\\s*(results?|resultados?)/i.test(document.body.innerText),
      { timeout: 8000 }
    );
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));
  out.matchedText = await page.evaluate(() => {
    const rx = /~?\\s*[\\d.,]+\\s*(results?|resultados?)/i;
    const heads = Array.from(document.querySelectorAll('[role="heading"]'));
    for (const h of heads) { const t = (h.innerText || "").trim(); if (rx.test(t)) return t; }
    const m = (document.body.innerText || "").match(rx);
    return m ? m[0].trim() : null;
  });
  return { data: out, type: "application/json" };
}`;

export function parseActive(text: string | null): number | null {
  if (!text) return null;
  const m = text.match(/[\d.,]+/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// Garante que a URL aponte para /function (a raiz devolve 404).
export function functionEndpoint(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (!/\/function\/?$/.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\/+$/, "") + "/function";
    }
    return u.toString();
  } catch {
    return rawUrl.replace(/\/+$/, "") + "/function";
  }
}

export async function callBrowserless(
  blUrl: string,
  token: string,
  pageUrl: string,
  timeoutMs: number,
): Promise<string | null> {
  const endpoint = functionEndpoint(blUrl);
  const sep = endpoint.includes("?") ? "&" : "?";
  const blTimeout = Math.min(Math.max(timeoutMs - 5000, 30000), 55000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint}${sep}token=${encodeURIComponent(token)}&timeout=${blTimeout}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: BROWSERLESS_SCRIPT, context: { url: pageUrl } }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Browserless HTTP ${res.status}`);
    const data = await res.json().catch(() => ({}));
    const payload = data && typeof data === "object" && "matchedText" in data ? data : (data?.data ?? data);
    return payload?.matchedText ?? null;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Executa a contagem de anúncios ativos de uma página com retries.
// Retorna { activeAds, matchedText, ok, errMsg }.
export async function measurePage(
  blUrl: string | null | undefined,
  token: string | null | undefined,
  pageUrl: string,
  opts: { timeoutMs: number; maxRetries: number },
): Promise<{ activeAds: number | null; matchedText: string | null; ok: boolean; errMsg: string | null }> {
  if (!blUrl || !token) {
    return { activeAds: null, matchedText: null, ok: false, errMsg: "Browserless não configurado (URL/token)." };
  }
  let activeAds: number | null = null;
  let matchedText: string | null = null;
  let errMsg: string | null = null;
  let ok = false;
  for (let attempt = 1; attempt <= opts.maxRetries && !ok; attempt++) {
    try {
      matchedText = await callBrowserless(blUrl, token, pageUrl, opts.timeoutMs);
      activeAds = parseActive(matchedText);
      if (activeAds === null) throw new Error(`Número não encontrado${matchedText ? ` (texto: "${matchedText}")` : ""}`);
      ok = true;
    } catch (e) {
      errMsg = String(e).slice(0, 260);
      if (attempt < opts.maxRetries) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { activeAds, matchedText, ok, errMsg };
}
