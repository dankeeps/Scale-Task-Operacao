// Capture an ad from the Meta Ad Library (via the ScaleTask extension):
// download the video, store it, transcribe it (ElevenLabs) and create a
// synced "swipe por transcrição" in the chosen workspace.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      project_id, title, video_url, library_url, ad_started_on, days_running, mime_type,
      offer_id, expert_id, niche_id, language_id, funnel_type_id,
    } = body;

    if (!project_id || !video_url) return json({ error: "project_id e video_url são obrigatórios" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Identify the caller and confirm workspace membership.
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData } = await service.auth.getUser(jwt);
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: membership } = await service
      .from("user_projects").select("role").eq("user_id", user.id).eq("project_id", project_id).maybeSingle();
    if (!membership) return json({ error: "Sem acesso a este workspace" }, 403);

    // 1) Download the ad video.
    const vres = await fetch(video_url);
    if (!vres.ok) return json({ error: `Falha ao baixar o vídeo (${vres.status})` }, 400);
    const bytes = new Uint8Array(await vres.arrayBuffer());
    const mt = mime_type || vres.headers.get("content-type") || "video/mp4";

    // 2) Store it in the swipe-videos bucket.
    const path = `captures/${crypto.randomUUID()}.mp4`;
    const { error: upErr } = await service.storage.from("swipe-videos").upload(path, bytes, { contentType: mt, upsert: false });
    if (upErr) return json({ error: "Falha ao salvar o vídeo: " + upErr.message }, 500);
    const { data: pub } = service.storage.from("swipe-videos").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // 3) Transcribe (reuse the existing function).
    const tr = await service.functions.invoke("transcribe-video", { body: { videoUrl: publicUrl, mimeType: mt } });
    if (tr.error) return json({ error: "Falha na transcrição: " + tr.error.message }, 502);
    const segments = tr.data?.segments ?? [];

    // 4) Create the transcription swipe (catalog ids come already resolved from the extension).
    const { data: inserted, error: insErr } = await service.from("swipe_transcriptions").insert({
      title: (title || "Anúncio").trim(),
      video_url: publicUrl,
      duration: null,
      segments,
      expert_id: expert_id || null,
      offer_id: offer_id || null,
      niche_id: niche_id || null,
      language_id: language_id || null,
      funnel_type_id: funnel_type_id || null,
      ad_library_link: library_url || "",
      funnel_link: "",
      thumbnail_url: "",
      ad_started_on: ad_started_on || null,
      days_running: days_running ?? null,
      created_by: user.id,
    }).select("id").single();

    if (insErr) return json({ error: "Falha ao criar o swipe: " + insErr.message }, 500);

    return json({ ok: true, id: inserted.id, segments: segments.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
