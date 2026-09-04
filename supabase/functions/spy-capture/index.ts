// Salva um "spy" manual capturado pela extensão (botão ninja) na Biblioteca de
// Anúncios: sobe o vídeo, transcreve (ElevenLabs), mede quantos anúncios ativos
// a página tinha NAQUELE momento (Browserless) e grava em spy_captures.
//
// Fica SÓ no Spy (não cria swipe_transcription). Sempre nasce com o
// monitoramento da página desligado — a pessoa liga depois em "Meu Spy".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pageAdsUrl, classify, nowISO } from "../_shared/spyClient.ts";
import { measurePage } from "../_shared/browserless.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let captureId: string | null = null;

  try {
    const body = await req.json();
    const {
      video_url, library_url, page_id, page_name, days_active, active_ads,
      keyword_id, keyword_text, format_id, format_text, niche_id, mime_type,
    } = body;

    // Identifica o autor (JWT do usuário).
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData } = await service.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado" }, 401);

    // Página (biblioteca) — garante um spy_pages para o monitoramento futuro.
    let spyPageId: string | null = null;
    if (page_id) {
      const { data: existing } = await service
        .from("spy_pages").select("id").eq("page_id", page_id).maybeSingle();
      if (existing) {
        spyPageId = existing.id;
        await service.from("spy_pages")
          .update({ page_name: page_name || "", ad_library_url: pageAdsUrl(page_id) })
          .eq("id", spyPageId);
      } else {
        const { data: ins } = await service.from("spy_pages").insert({
          page_id, page_name: page_name || "", ad_library_url: pageAdsUrl(page_id),
        }).select("id").single();
        spyPageId = ins?.id ?? null;
      }
    }

    // Cria o capture já em "processing" (aparece na hora em "Meu Spy" via realtime).
    const { data: cap, error: capErr } = await service.from("spy_captures").insert({
      user_id: user.id,
      spy_page_id: spyPageId,
      page_id: page_id || null,
      page_name: page_name || "",
      ad_library_url: library_url || (page_id ? pageAdsUrl(page_id) : ""),
      keyword_id: keyword_id || null,
      keyword_text: keyword_text || null,
      format_id: format_id || null,
      format_text: format_text || null,
      days_active: Number.isFinite(days_active) ? days_active : null,
      status: "processing",
    }).select("id").single();
    if (capErr) return json({ error: "Falha ao criar o spy: " + capErr.message }, 500);
    captureId = cap.id;

    // 1) Vídeo → storage + transcrição (se houver vídeo).
    let publicUrl: string | null = null;
    let segments: unknown[] = [];
    if (video_url) {
      const vres = await fetch(video_url);
      if (!vres.ok) throw new Error(`Falha ao baixar o vídeo (${vres.status})`);
      const bytes = new Uint8Array(await vres.arrayBuffer());
      const mt = mime_type || vres.headers.get("content-type") || "video/mp4";
      const path = `spy/${crypto.randomUUID()}.mp4`;
      const { error: upErr } = await service.storage.from("swipe-videos").upload(path, bytes, { contentType: mt, upsert: false });
      if (upErr) throw new Error("Falha ao salvar o vídeo: " + upErr.message);
      publicUrl = service.storage.from("swipe-videos").getPublicUrl(path).data.publicUrl;

      const tr = await service.functions.invoke("transcribe-video", { body: { videoUrl: publicUrl, mimeType: mt } });
      if (!tr.error && Array.isArray(tr.data?.segments)) segments = tr.data.segments;
    }

    // O spy também vira um swipe (biblioteca do Swipe) — versão minimalista:
    // título = nome da biblioteca, com formato/dias/link; catálogos ficam vazios.
    let transcriptionId: string | null = null;
    if (publicUrl) {
      const { data: swipeIns } = await service.from("swipe_transcriptions").insert({
        title: page_name || "Spy",
        video_url: publicUrl,
        duration: null,
        segments,
        ad_library_link: library_url || "",
        days_running: Number.isFinite(days_active) ? days_active : null,
        format_id: format_id || null,
        niche_id: niche_id || null,
        created_by: user.id,
      }).select("id").single();
      transcriptionId = swipeIns?.id ?? null;
    }

    // 2) Anúncios ativos NAQUELE momento: usa a contagem que a extensão leu da
    // própria página (mais confiável/rápida); se não veio, mede via Browserless.
    let activeAds: number | null = null;
    let potential: string | null = null;
    if (page_id) {
      const { data: ranges } = await service.from("spy_potential_ranges").select("*").eq("is_active", true);
      const clientCount = Number.isFinite(active_ads) ? Number(active_ads) : null;
      let ok = false;
      if (clientCount != null) {
        activeAds = clientCount;
        ok = true;
      } else {
        const { data: settings } = await service.from("spy_settings").select("*").limit(1).maybeSingle();
        const token = Deno.env.get("BROWSERLESS_TOKEN");
        const measured = await measurePage(settings?.browserless_url, token, pageAdsUrl(page_id), {
          timeoutMs: (settings?.request_timeout ?? 120) * 1000,
          maxRetries: settings?.max_retries ?? 3,
        });
        activeAds = measured.activeAds;
        ok = measured.ok;
      }
      potential = classify(activeAds, ranges ?? []);
      if (spyPageId && ok && activeAds != null) {
        await service.from("spy_pages").update({
          current_active_ads: activeAds, current_potential: potential, last_checked_at: nowISO(),
        }).eq("id", spyPageId);
        await service.from("spy_page_snapshots").insert({
          spy_page_id: spyPageId, run_id: null, active_ads: activeAds, potential, status: "success",
        });
      }
    }

    // 3) Finaliza o capture.
    await service.from("spy_captures").update({
      video_url: publicUrl,
      segments,
      active_ads_at_capture: activeAds,
      potential,
      transcription_id: transcriptionId,
      status: "done",
    }).eq("id", captureId);

    return json({ ok: true, id: captureId, active_ads: activeAds, days_active, segments: segments.length });
  } catch (e) {
    const msg = String(e).slice(0, 300);
    if (captureId) {
      await service.from("spy_captures").update({ status: "error", error_message: msg }).eq("id", captureId);
    }
    return json({ error: msg, id: captureId }, 500);
  }
});
