// ScaleTask — Meta Ad Library capture.
// Injects a button on each ad card. Clicking opens a modal to save the ad
// (workspace + oferta/expert/nicho/idioma/tipo de funil, all pulled from the same
// ScaleTask catalogs) and kicks off the download + synced transcription.
//
// NOTE: The Ad Library DOM changes often. The heuristics below (finding the card,
// the "start running" date and the video URL) are the parts most likely to need tuning.

(() => {
  const ST_TAG = "data-st-injected";

  const CATALOGS = [
    { key: "offer_id", label: "Oferta", table: "swipe_offers" },
    { key: "expert_id", label: "Expert", table: "swipe_experts" },
    { key: "niche_id", label: "Nicho", table: "swipe_niches" },
    { key: "language_id", label: "Idioma", table: "swipe_languages" },
    { key: "funnel_type_id", label: "Tipo de funil", table: "swipe_funnel_types" },
  ];

  const esc = (s) => (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---- Session / REST helpers -------------------------------------------------
  async function getSession() {
    const { st_session } = await chrome.storage.local.get("st_session");
    return st_session || null;
  }

  function headers(session, extra = {}) {
    return {
      apikey: ST_CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async function api(path, session) {
    const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/rest/v1/${path}`, { headers: headers(session) });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }

  // Renova o access_token usando o refresh_token e regrava na storage.
  async function refreshSession(session) {
    const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ST_CONFIG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new Error("refresh failed");
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || session.refresh_token,
      user: data.user || session.user,
    };
    await chrome.storage.local.set({ st_session: next });
    return next;
  }

  function tokenExpired(session) {
    try {
      const p = JSON.parse(atob(session.access_token.split(".")[1]));
      return !p.exp || p.exp * 1000 < Date.now() + 60000; // expirado ou <1min de validade
    } catch { return true; }
  }

  // Sessão com token válido — renova sozinha se estiver expirado (JWT dura ~1h).
  async function getValidSession() {
    const session = await getSession();
    if (!session) return null;
    if (tokenExpired(session) && session.refresh_token) {
      try { return await refreshSession(session); } catch { return session; }
    }
    return session;
  }

  async function fetchProjects(session) {
    const rows = await api(`user_projects?select=project_id,projects(id,name)&user_id=eq.${session.user.id}`, session);
    return (rows || []).map((r) => r.projects).filter(Boolean);
  }

  async function fetchCatalog(session, table) {
    return (await api(`${table}?select=id,name&order=name.asc`, session)) || [];
  }

  async function addCatalog(session, table, name) {
    const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: headers(session, { Prefer: "return=representation" }),
      body: JSON.stringify({ name, created_by: session.user.id }),
    });
    if (res.ok) return (await res.json())[0];
    // Unique clash -> fetch the existing one.
    const existing = await api(`${table}?select=id,name&name=eq.${encodeURIComponent(name)}`, session);
    if (existing?.[0]) return existing[0];
    throw new Error("Não foi possível adicionar");
  }

  // Palavras-chave do PRÓPRIO usuário (RLS já filtra, mas mandamos o filtro explícito).
  async function fetchKeywords(session) {
    return (await api(`spy_keywords?select=id,keyword&user_id=eq.${session.user.id}&order=keyword.asc`, session)) || [];
  }
  async function addKeyword(session, keyword) {
    const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/rest/v1/spy_keywords`, {
      method: "POST",
      headers: headers(session, { Prefer: "return=representation" }),
      body: JSON.stringify({ keyword, user_id: session.user.id }),
    });
    if (res.ok) return (await res.json())[0];
    throw new Error("Não foi possível adicionar a palavra-chave");
  }

  // Formatos: catálogo compartilhado (padrão dos catálogos do Swipe).
  async function fetchFormats(session) {
    return (await api(`swipe_formats?select=id,name&order=name.asc`, session)) || [];
  }
  async function addFormat(session, name) {
    const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/rest/v1/swipe_formats`, {
      method: "POST",
      headers: headers(session, { Prefer: "return=representation" }),
      body: JSON.stringify({ name, created_by: session.user.id }),
    });
    if (res.ok) return (await res.json())[0];
    const existing = await api(`swipe_formats?select=id,name&name=eq.${encodeURIComponent(name)}`, session);
    if (existing?.[0]) return existing[0];
    throw new Error("Não foi possível adicionar o formato");
  }

  // Nichos: catálogo do Swipe (swipe_niches).
  async function fetchNiches(session) {
    return (await api(`swipe_niches?select=id,name&order=name.asc`, session)) || [];
  }
  async function addNiche(session, name) {
    const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/rest/v1/swipe_niches`, {
      method: "POST",
      headers: headers(session, { Prefer: "return=representation" }),
      body: JSON.stringify({ name, created_by: session.user.id }),
    });
    if (res.ok) return (await res.json())[0];
    const existing = await api(`swipe_niches?select=id,name&name=eq.${encodeURIComponent(name)}`, session);
    if (existing?.[0]) return existing[0];
    throw new Error("Não foi possível adicionar o nicho");
  }

  // ---- Date parsing -----------------------------------------------------------
  const PT_MONTHS = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
  const EN_MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function parseStartDate(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    let m = t.match(/(?:iniciada?|come[çc]ou|veicula[çc][aã]o).{0,20}?(\d{1,2})\s+de\s+([a-zç]{3,})\.?\s+de\s+(\d{4})/);
    if (m) { const mon = PT_MONTHS[m[2].slice(0, 3)]; if (mon != null) return new Date(Date.UTC(+m[3], mon, +m[1])); }
    m = t.match(/started running on\s+([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m) { const mon = EN_MONTHS[m[1].slice(0, 3)]; if (mon != null) return new Date(Date.UTC(+m[3], mon, +m[2])); }
    return null;
  }

  const ymd = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  // ---- Card detection ---------------------------------------------------------
  function cardOf(el) {
    let node = el;
    for (let i = 0; i < 8 && node && node.parentElement; i++) {
      node = node.parentElement;
      const r = node.getBoundingClientRect();
      if (r.width > 250 && r.height > 250) return node;
    }
    return el.parentElement;
  }

  function findCards() {
    const cards = new Set();
    for (const el of document.querySelectorAll("div, span")) {
      if (el.childElementCount > 0) continue;
      const txt = (el.textContent || "").trim();
      if (!txt) continue;
      if (/identifica[çc][aã]o da biblioteca|library id|veicula[çc][aã]o iniciada|started running on/i.test(txt)) {
        const card = cardOf(el);
        if (card) cards.add(card);
      }
    }
    return [...cards];
  }

  function extractVideoUrl(card) {
    const v = card.querySelector("video");
    const direct = v?.currentSrc || v?.src || card.querySelector("video source")?.src || "";
    if (direct.startsWith("http")) return direct.replace(/&amp;/g, "&");
    const m = card.outerHTML.match(/https:\/\/[^"'\\ ]*fbcdn[^"'\\ ]*\.mp4[^"'\\ ]*/);
    return m ? m[0].replace(/&amp;/g, "&") : "";
  }

  function extractInfo(card) {
    const text = card.innerText || "";
    const start = parseStartDate(text);
    let days = null;
    if (start) days = Math.max(0, Math.round((Date.now() - start.getTime()) / 86400000));
    let url = location.href;
    const idm = text.match(/(?:identifica[çc][aã]o da biblioteca|library id)[:\s]*?(\d{6,})/i);
    if (idm) url = `https://www.facebook.com/ads/library/?id=${idm[1]}`;
    return { start, days, url, video_url: extractVideoUrl(card) };
  }

  // ---- Modal ------------------------------------------------------------------
  function catalogRowHtml(c) {
    return `
      <label>${c.label}</label>
      <div class="st-row">
        <select class="st-f st-sel" data-key="${c.key}"><option value="">Carregando…</option></select>
        <input class="st-f st-newname hidden" data-key="${c.key}" placeholder="Digite e pressione Enter" />
        <button type="button" class="st-plus" data-key="${c.key}" title="Adicionar novo">+</button>
      </div>`;
  }

  function fillSelect(sel, items) {
    sel.innerHTML = `<option value="">Selecionar</option>` + items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("");
  }

  function openModal(card) {
    document.querySelector(".st-modal-backdrop")?.remove();
    const info = extractInfo(card);

    const back = document.createElement("div");
    back.className = "st-modal-backdrop";
    back.innerHTML = `
      <div class="st-modal">
        <div class="st-modal-head">
          <span>Salvar anúncio no ScaleTask</span>
          <button class="st-x" title="Fechar">✕</button>
        </div>
        <div class="st-scroll">
          <label>Workspace</label>
          <select class="st-f" id="st-project"><option value="">Carregando…</option></select>
          ${CATALOGS.map(catalogRowHtml).join("")}
          <div class="st-meta" id="st-meta"></div>
        </div>
        <button class="st-save" id="st-save">Salvar</button>
        <div class="st-prog-wrap hidden" id="st-save-prog">
          <div class="st-prog"><div class="st-prog-fill" id="st-save-fill"></div></div>
          <div class="st-prog-info"><span id="st-save-pct">0%</span><span>Baixando + transcrevendo…</span></div>
        </div>
        <p class="st-err" id="st-err"></p>
      </div>`;
    document.body.appendChild(back);

    const close = () => back.remove();
    back.querySelector(".st-x").onclick = close;
    back.onclick = (e) => { if (e.target === back) close(); };

    const meta = back.querySelector("#st-meta");
    if (info.start) meta.textContent = `Veiculação iniciada em ${info.start.toLocaleDateString("pt-BR")} · rodando há ${info.days} dia(s)`;
    else { meta.textContent = "Data de início não detectada automaticamente."; meta.classList.add("st-warn"); }

    (async () => {
      const session = await getValidSession();
      if (!session) {
        back.querySelector("#st-err").textContent = "Faça login pela extensão (ícone do ScaleTask na barra).";
        return;
      }

      // Workspaces
      const projSel = back.querySelector("#st-project");
      try {
        const projects = await fetchProjects(session);
        projSel.innerHTML = projects.length
          ? projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")
          : `<option value="">Nenhum workspace</option>`;
      } catch { projSel.innerHTML = `<option value="">Erro ao carregar</option>`; }

      // Catalogs — "+" turns the dropdown into a text field (type + Enter to add).
      for (const c of CATALOGS) {
        const sel = back.querySelector(`.st-sel[data-key="${c.key}"]`);
        const input = back.querySelector(`.st-newname[data-key="${c.key}"]`);
        const plus = back.querySelector(`.st-plus[data-key="${c.key}"]`);
        try { fillSelect(sel, await fetchCatalog(session, c.table)); }
        catch { sel.innerHTML = `<option value="">Erro</option>`; }

        const showInput = () => { sel.classList.add("hidden"); input.classList.remove("hidden"); input.value = ""; input.focus(); };
        const showSelect = () => { input.classList.add("hidden"); sel.classList.remove("hidden"); };
        const commit = async () => {
          const name = input.value.trim();
          if (!name) { showSelect(); return; }
          try {
            const item = await addCatalog(session, c.table, name);
            let opt = [...sel.options].find((o) => o.value === item.id);
            if (!opt) { opt = document.createElement("option"); opt.value = item.id; opt.textContent = item.name; sel.appendChild(opt); }
            sel.value = item.id;
            showSelect();
          } catch (e) { back.querySelector("#st-err").textContent = "Erro ao adicionar: " + e.message; }
        };

        plus.onclick = () => { input.classList.contains("hidden") ? showInput() : commit(); };
        input.onkeydown = (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") showSelect();
        };
      }

      // Save -> download + transcribe
      back.querySelector("#st-save").onclick = async () => {
        const btn = back.querySelector("#st-save");
        const err = back.querySelector("#st-err");
        err.textContent = "";
        const project_id = projSel.value;
        const get = (k) => back.querySelector(`.st-sel[data-key="${k}"]`).value || null;
        const offerSel = back.querySelector(`.st-sel[data-key="offer_id"]`);
        const title = offerSel.options[offerSel.selectedIndex]?.text || "Anúncio";

        if (!project_id) { err.textContent = "Selecione um workspace."; return; }
        if (!get("offer_id")) { err.textContent = "Selecione a oferta."; return; }
        if (!get("expert_id")) { err.textContent = "Selecione o expert."; return; }
        if (!info.video_url) { err.textContent = "Não achei o vídeo. Dê play no anúncio e tente de novo."; return; }

        btn.disabled = true;
        btn.textContent = "Transcrevendo…";
        const progWrap = back.querySelector("#st-save-prog");
        progWrap.classList.remove("hidden");
        const prog = runProgress(back.querySelector("#st-save-fill"), back.querySelector("#st-save-pct"), estimateMs(card));
        try {
          const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/functions/v1/capture-ad`, {
            method: "POST",
            headers: headers(session),
            body: JSON.stringify({
              project_id,
              title,
              offer_id: get("offer_id"),
              expert_id: get("expert_id"),
              niche_id: get("niche_id"),
              language_id: get("language_id"),
              funnel_type_id: get("funnel_type_id"),
              video_url: info.video_url,
              library_url: info.url,
              ad_started_on: info.start ? ymd(info.start) : null,
              days_running: info.days,
              mime_type: "video/mp4",
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
          prog.finish();
          btn.textContent = `Salvo ✓ (${data.segments} segmentos)`;
          setTimeout(close, 1200);
        } catch (e) {
          prog.stop();
          progWrap.classList.add("hidden");
          err.textContent = "Erro: " + e.message;
          btn.disabled = false; btn.textContent = "Salvar";
        }
      };
    })();
  }

  // ---- Progress bar -----------------------------------------------------------
  // A transcrição é 1 requisição só (sem stream), então a barra é uma estimativa:
  // avança suavemente rumo a ~92% no tempo esperado e completa quando a resposta chega.
  function estimateMs(card) {
    const v = card?.querySelector?.("video");
    const dur = v && Number.isFinite(v.duration) ? v.duration : 0;
    const sec = dur ? Math.max(15, dur * 0.7 + 12) : 45;
    return sec * 1000;
  }

  function runProgress(fillEl, pctEl, estMs) {
    const start = Date.now();
    let done = false;
    const iv = setInterval(() => {
      if (done) return;
      const t = (Date.now() - start) / estMs;
      const pct = Math.min(92, Math.round((1 - Math.exp(-2.2 * t)) * 100));
      fillEl.style.width = pct + "%";
      if (pctEl) pctEl.textContent = pct + "%";
    }, 150);
    return {
      finish() { done = true; clearInterval(iv); fillEl.style.width = "100%"; if (pctEl) pctEl.textContent = "100%"; },
      stop() { done = true; clearInterval(iv); },
    };
  }

  // ---- Preview local (transcreve e mostra aqui — NÃO salva no sistema) --------
  function segmentsToText(segments) {
    return (segments || []).map((s) => s.text).join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
  }

  function cornerHost() {
    let host = document.getElementById("st-corner-host");
    if (!host) { host = document.createElement("div"); host.id = "st-corner-host"; document.body.appendChild(host); }
    return host;
  }

  // Transcrição no canto inferior — NÃO bloqueia o site (dá pra continuar usando).
  async function openPreview(card) {
    const video_url = extractVideoUrl(card);
    const panel = document.createElement("div");
    panel.className = "st-panel";
    panel.innerHTML = `
      <div class="st-panel-head"><span>Transcrição</span><button class="st-panel-x" title="Fechar">✕</button></div>
      <div class="st-panel-body">
        <div class="st-prog-wrap">
          <div class="st-prog"><div class="st-prog-fill"></div></div>
          <div class="st-prog-info"><span class="st-pct">0%</span><span>Transcrevendo…</span></div>
        </div>
      </div>`;
    cornerHost().appendChild(panel);
    panel.querySelector(".st-panel-x").onclick = () => panel.remove();
    const body = panel.querySelector(".st-panel-body");

    if (!video_url) { body.innerHTML = '<p class="st-panel-err">Não achei o vídeo. Dê play no anúncio e tente de novo.</p>'; return; }

    const prog = runProgress(panel.querySelector(".st-prog-fill"), panel.querySelector(".st-pct"), estimateMs(card));
    try {
      const session = await getValidSession();
      if (!session) throw new Error("Faça login pela extensão.");
      const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: "POST", headers: headers(session), body: JSON.stringify({ videoUrl: video_url, mimeType: "video/mp4" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Sessão expirada — faça login de novo na extensão.");
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      prog.finish();
      const text = segmentsToText(data.segments);
      body.innerHTML = `<div class="st-transcript">${esc(text) || "(sem fala detectada)"}</div><button class="st-copy" style="margin-top:10px">Copiar transcrição</button>`;
      body.querySelector(".st-copy").onclick = async () => { try { await navigator.clipboard.writeText(text); body.querySelector(".st-copy").textContent = "Copiado ✓"; } catch {} };
    } catch (e) {
      prog.stop();
      body.innerHTML = `<p class="st-panel-err">Erro: ${esc(e.message || String(e))}</p>`;
    }
  }

  // ---- Ninja (salvar spy) -----------------------------------------------------
  // Extrai, best-effort, o page_id + nome da biblioteca do card. O DOM da Ad
  // Library muda com frequência — esses heurísticos são os que mais podem precisar
  // de ajuste. Se não achar o page_id, o spy salva mesmo assim (sem contagem).
  function extractPageInfo(card) {
    const html = card.outerHTML;
    let page_id = null;
    // 1) Estando na biblioteca de UMA página, o page_id está direto na URL (mais confiável).
    const urlPid = new URLSearchParams(location.search).get("view_all_page_id");
    if (urlPid && /^\d{5,}$/.test(urlPid)) page_id = urlPid;
    // 2) senão, tenta achar no HTML do card.
    if (!page_id) {
      const m = html.match(/view_all_page_id["'=:\s]*?(\d{5,})/) || html.match(/"page_id"\s*:\s*"?(\d{5,})/);
      if (m) page_id = m[1];
    }
    let page_name = "";
    const anchors = [...card.querySelectorAll('a[href*="facebook.com"]')];
    for (const a of anchors) {
      const t = (a.innerText || "").trim();
      if (t && t.length < 60 && !/patrocinad|sponsored|ver resumo|see summary|detalhes|details|biblioteca|library/i.test(t)) {
        page_name = t;
        const am = a.href.match(/view_all_page_id=(\d{5,})/);
        if (am && !page_id) page_id = am[1];
        break;
      }
    }
    const library_url = page_id
      ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&media_type=all&search_type=page&view_all_page_id=${page_id}`
      : location.href;
    return { page_id, page_name, library_url };
  }

  // Lê a quantidade de anúncios ativos ("~X resultados") direto da página — só é
  // confiável quando estamos vendo a biblioteca de UMA página (view_all_page_id na URL).
  function readActiveCount() {
    if (!new URLSearchParams(location.search).get("view_all_page_id")) return null;
    const rx = /~?\s*([\d.,]+)\s*(results?|resultados?|an[úu]ncios?)/i;
    for (const h of document.querySelectorAll('[role="heading"]')) {
      const m = (h.textContent || "").match(rx);
      if (m) { const n = parseInt(m[1].replace(/[.,]/g, ""), 10); if (Number.isFinite(n)) return n; }
    }
    const m = (document.body.innerText || "").match(rx);
    if (m) { const n = parseInt(m[1].replace(/[.,]/g, ""), 10); if (Number.isFinite(n)) return n; }
    return null;
  }

  // Barra flutuante no canto inferior: o spy processa em background enquanto a
  // pessoa continua navegando. Fecha o popup na hora e mostra "Concluído" ao fim.
  function cornerBar(label) {
    let host = document.getElementById("st-corner-host");
    if (!host) { host = document.createElement("div"); host.id = "st-corner-host"; document.body.appendChild(host); }
    const bar = document.createElement("div");
    bar.className = "st-corner";
    bar.innerHTML = `<div class="st-corner-row"><span class="st-corner-spin"></span><span class="st-corner-label">${esc(label)}</span></div><div class="st-corner-track"><div class="st-corner-fill"></div></div>`;
    host.appendChild(bar);
    const fill = bar.querySelector(".st-corner-fill");
    const lab = bar.querySelector(".st-corner-label");
    const spin = bar.querySelector(".st-corner-spin");
    const start = Date.now(); let done = false; const est = 60000;
    const iv = setInterval(() => {
      if (done) return;
      const t = (Date.now() - start) / est;
      fill.style.width = Math.min(92, Math.round((1 - Math.exp(-2.0 * t)) * 100)) + "%";
    }, 200);
    return {
      finish(msg) { done = true; clearInterval(iv); fill.style.width = "100%"; bar.classList.add("st-corner-done"); spin.style.display = "none"; lab.textContent = msg || "Concluído ✓"; setTimeout(() => bar.remove(), 4500); },
      error(msg) { done = true; clearInterval(iv); bar.classList.add("st-corner-err"); spin.style.display = "none"; lab.textContent = msg || "Erro"; setTimeout(() => bar.remove(), 7000); },
    };
  }

  async function openNinja(card) {
    document.querySelector(".st-modal-backdrop")?.remove();
    const info = extractInfo(card);
    const pinfo = extractPageInfo(card);
    const activeAds = readActiveCount();
    const urlQ = new URLSearchParams(location.search).get("q") || "";

    const back = document.createElement("div");
    back.className = "st-modal-backdrop";
    back.innerHTML = `
      <div class="st-modal st-ninja">
        <div class="st-modal-head">
          <span>🥷 Salvar spy</span>
          <button class="st-x" title="Fechar">✕</button>
        </div>
        <div class="st-scroll">
          <label>Biblioteca (nome)</label>
          <input class="st-f" id="st-nj-page" placeholder="Nome da biblioteca" value="${esc(pinfo.page_name)}" />
          <div class="st-meta" id="st-nj-meta"></div>
          <label>Palavra-chave pesquisada</label>
          <div class="st-row">
            <select class="st-f st-sel" id="st-nj-kw"><option value="">Carregando…</option></select>
            <input class="st-f st-newname hidden" id="st-nj-kwnew" placeholder="Nova palavra-chave + Enter" />
            <button type="button" class="st-plus" id="st-nj-kwadd" title="Adicionar palavra-chave">+</button>
          </div>
          <label>Formato (opcional)</label>
          <div class="st-row">
            <select class="st-f st-sel" id="st-nj-fmt"><option value="">—</option></select>
            <input class="st-f st-newname hidden" id="st-nj-fmtnew" placeholder="Novo formato + Enter" />
            <button type="button" class="st-plus" id="st-nj-fmtadd" title="Adicionar formato">+</button>
          </div>
          <label>Nicho (opcional)</label>
          <div class="st-row">
            <select class="st-f st-sel" id="st-nj-niche"><option value="">—</option></select>
            <input class="st-f st-newname hidden" id="st-nj-nichenew" placeholder="Novo nicho + Enter" />
            <button type="button" class="st-plus" id="st-nj-nicheadd" title="Adicionar nicho">+</button>
          </div>
        </div>
        <button class="st-save" id="st-nj-save">Salvar spy</button>
        <p class="st-err" id="st-nj-err"></p>
      </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.querySelector(".st-x").onclick = close;
    back.onclick = (e) => { if (e.target === back) close(); };

    const meta = back.querySelector("#st-nj-meta");
    const bits = [];
    if (info.days != null) bits.push(`rodando há ${info.days} dia(s)`);
    if (activeAds != null) bits.push(`${activeAds} anúncios ativos`);
    if (!pinfo.page_id) bits.push("biblioteca não detectada — abra a página do anunciante p/ capturar a contagem");
    if (!info.video_url) bits.push("sem vídeo (salva sem transcrição)");
    meta.textContent = bits.join(" · ") || "Pronto para salvar.";
    if (!pinfo.page_id || !info.video_url) meta.classList.add("st-warn");

    const err = back.querySelector("#st-nj-err");
    (async () => {
      const session = await getValidSession();
      if (!session) { err.textContent = "Faça login pela extensão (ícone do ScaleTask na barra)."; return; }

      const kwSel = back.querySelector("#st-nj-kw");
      const kwNew = back.querySelector("#st-nj-kwnew");
      const kwAdd = back.querySelector("#st-nj-kwadd");
      try {
        const kws = await fetchKeywords(session);
        kwSel.innerHTML = `<option value="">Nenhuma (orgânico)</option>` +
          kws.map((k) => `<option value="${k.id}" data-text="${esc(k.keyword)}">${esc(k.keyword)}</option>`).join("");
        if (urlQ) { const match = kws.find((k) => (k.keyword || "").toLowerCase() === urlQ.toLowerCase()); if (match) kwSel.value = match.id; }
      } catch { kwSel.innerHTML = `<option value="">Erro ao carregar</option>`; }

      const showInput = () => { kwSel.classList.add("hidden"); kwNew.classList.remove("hidden"); kwNew.value = urlQ || ""; kwNew.focus(); };
      const showSelect = () => { kwNew.classList.add("hidden"); kwSel.classList.remove("hidden"); };
      const commit = async () => {
        const name = kwNew.value.trim();
        if (!name) { showSelect(); return; }
        try {
          const item = await addKeyword(session, name);
          let opt = [...kwSel.options].find((o) => o.value === item.id);
          if (!opt) { opt = document.createElement("option"); opt.value = item.id; opt.dataset.text = item.keyword; opt.textContent = item.keyword; kwSel.appendChild(opt); }
          kwSel.value = item.id;
          showSelect();
        } catch (e) { err.textContent = "Erro ao adicionar: " + e.message; }
      };
      kwAdd.onclick = () => { kwNew.classList.contains("hidden") ? showInput() : commit(); };
      kwNew.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") showSelect(); };

      // Formato (catálogo, opcional) — mesmo padrão do "adicionar".
      const fmtSel = back.querySelector("#st-nj-fmt");
      const fmtNew = back.querySelector("#st-nj-fmtnew");
      const fmtAdd = back.querySelector("#st-nj-fmtadd");
      try {
        const fmts = await fetchFormats(session);
        fmtSel.innerHTML = `<option value="">—</option>` +
          fmts.map((f) => `<option value="${f.id}" data-text="${esc(f.name)}">${esc(f.name)}</option>`).join("");
      } catch { fmtSel.innerHTML = `<option value="">Erro</option>`; }
      const fmtShowInput = () => { fmtSel.classList.add("hidden"); fmtNew.classList.remove("hidden"); fmtNew.value = ""; fmtNew.focus(); };
      const fmtShowSelect = () => { fmtNew.classList.add("hidden"); fmtSel.classList.remove("hidden"); };
      const fmtCommit = async () => {
        const name = fmtNew.value.trim();
        if (!name) { fmtShowSelect(); return; }
        try {
          const item = await addFormat(session, name);
          let opt = [...fmtSel.options].find((o) => o.value === item.id);
          if (!opt) { opt = document.createElement("option"); opt.value = item.id; opt.dataset.text = item.name; opt.textContent = item.name; fmtSel.appendChild(opt); }
          fmtSel.value = item.id;
          fmtShowSelect();
        } catch (e) { err.textContent = "Erro ao adicionar formato: " + e.message; }
      };
      fmtAdd.onclick = () => { fmtNew.classList.contains("hidden") ? fmtShowInput() : fmtCommit(); };
      fmtNew.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); fmtCommit(); } if (e.key === "Escape") fmtShowSelect(); };

      // Nicho (catálogo, opcional) — mesmo padrão.
      const nicheSel = back.querySelector("#st-nj-niche");
      const nicheNew = back.querySelector("#st-nj-nichenew");
      const nicheAdd = back.querySelector("#st-nj-nicheadd");
      try {
        const nichesList = await fetchNiches(session);
        nicheSel.innerHTML = `<option value="">—</option>` + nichesList.map((n) => `<option value="${n.id}">${esc(n.name)}</option>`).join("");
      } catch { nicheSel.innerHTML = `<option value="">Erro</option>`; }
      const nicheShowInput = () => { nicheSel.classList.add("hidden"); nicheNew.classList.remove("hidden"); nicheNew.value = ""; nicheNew.focus(); };
      const nicheShowSelect = () => { nicheNew.classList.add("hidden"); nicheSel.classList.remove("hidden"); };
      const nicheCommit = async () => {
        const name = nicheNew.value.trim();
        if (!name) { nicheShowSelect(); return; }
        try {
          const item = await addNiche(session, name);
          let opt = [...nicheSel.options].find((o) => o.value === item.id);
          if (!opt) { opt = document.createElement("option"); opt.value = item.id; opt.textContent = item.name; nicheSel.appendChild(opt); }
          nicheSel.value = item.id;
          nicheShowSelect();
        } catch (e) { err.textContent = "Erro ao adicionar nicho: " + e.message; }
      };
      nicheAdd.onclick = () => { nicheNew.classList.contains("hidden") ? nicheShowInput() : nicheCommit(); };
      nicheNew.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); nicheCommit(); } if (e.key === "Escape") nicheShowSelect(); };

      // Salvar → fecha o popup na hora e processa em background com a barrinha do canto.
      back.querySelector("#st-nj-save").onclick = () => {
        const page_name = back.querySelector("#st-nj-page").value.trim();
        const keyword_id = kwSel.value || null;
        const keyword_text = keyword_id ? (kwSel.options[kwSel.selectedIndex]?.dataset.text || "") : null;
        const format_id = fmtSel.value || null;
        const format_text = format_id ? (fmtSel.options[fmtSel.selectedIndex]?.dataset.text || "") : null;
        const niche_id = nicheSel.value || null;
        close();
        const bar = cornerBar("Salvando spy…");
        (async () => {
          try {
            const res = await fetch(`${ST_CONFIG.SUPABASE_URL}/functions/v1/spy-capture`, {
              method: "POST",
              headers: headers(session),
              body: JSON.stringify({
                video_url: info.video_url,
                library_url: pinfo.library_url,
                page_id: pinfo.page_id,
                page_name,
                days_active: info.days,
                active_ads: activeAds,
                keyword_id,
                keyword_text,
                format_id,
                format_text,
                niche_id,
                mime_type: "video/mp4",
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
            const cnt = data.active_ads != null ? ` · ${data.active_ads} ativos` : "";
            bar.finish(`Spy salvo ✓${cnt}`);
          } catch (e) { bar.error("Erro: " + String(e.message || e).slice(0, 80)); }
        })();
      };
    })();
  }

  // ---- Download ---------------------------------------------------------------
  const ST_SPINNER = '<svg class="st-spin-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

  // Nome do arquivo: usa a identificação da biblioteca se houver, senão timestamp.
  function filenameFor(card) {
    const text = card.innerText || "";
    const idm = text.match(/(?:identifica[çc][aã]o da biblioteca|library id)[:\s]*?(\d{6,})/i);
    const id = idm ? idm[1] : String(Date.now());
    return `anuncio-${id}.mp4`;
  }

  // Baixa o vídeo do anúncio direto no computador (fetch -> blob -> <a download>).
  // Precisa da permissão de host de *.fbcdn.net no manifest p/ ler cross-origin.
  async function downloadVideo(card, btn) {
    const url = extractVideoUrl(card);
    if (!url) { btn.title = "Não achei o vídeo. Dê play no anúncio e tente de novo."; return; }
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = ST_SPINNER;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filenameFor(card);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      btn.title = "Baixar vídeo";
    } catch (e) {
      btn.title = "Falha ao baixar: " + String(e.message || e).slice(0, 80);
      console.error("[ScaleTask] download falhou:", e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // ---- Injection --------------------------------------------------------------
  function inject() {
    for (const card of findCards()) {
      if (card.getAttribute(ST_TAG)) continue;
      // Ancora os ícones NO canto do vídeo. Se o vídeo ainda não carregou, não
      // marca o card — tenta de novo na próxima mutação (vídeo é lazy).
      const video = card.querySelector("video");
      if (!video) continue;
      card.setAttribute(ST_TAG, "1");
      const host = video.parentElement || card;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";

      const bar = document.createElement("div");
      bar.className = "st-iconbar";

      // Transcrever (preview local, não salva) — só ícone.
      const pv = document.createElement("button");
      pv.className = "st-icon-btn";
      pv.title = "Transcrever (sem salvar)";
      pv.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/></svg>';
      pv.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openPreview(card); };

      // Baixar vídeo direto no computador — só ícone.
      const dl = document.createElement("button");
      dl.className = "st-icon-btn";
      dl.title = "Baixar vídeo";
      dl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      dl.onclick = (e) => { e.preventDefault(); e.stopPropagation(); downloadVideo(card, dl); };

      // Spy (salva como spy) — só ícone (olho).
      const nj = document.createElement("button");
      nj.className = "st-icon-btn";
      nj.title = "Salvar spy";
      nj.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
      nj.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openNinja(card); };

      bar.appendChild(pv);
      bar.appendChild(dl);
      bar.appendChild(nj);
      host.appendChild(bar);
    }
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; inject(); }, 400);
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
})();
