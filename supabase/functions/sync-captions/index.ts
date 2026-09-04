// "Sincronizar legenda com vídeo": re-transcreve uma swipe_transcription com o
// ElevenLabs Scribe (timestamps word-level) para a legenda casar certinho com o
// vídeo, e atualiza os segmentos. Mais lento que o OpenAI, mas mais preciso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { elevenLabsFromUrl, getElevenLabsKey } from "../_shared/transcribe.ts";

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
  try {
    const { transcriptionId } = await req.json().catch(() => ({}));
    if (!transcriptionId) return json({ error: "transcriptionId é obrigatório" }, 400);

    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData } = await service.auth.getUser(jwt);
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);

    const EL = await getElevenLabsKey(service);
    if (!EL) return json({ error: "Chave do ElevenLabs não configurada (Configurações → ElevenLabs)" }, 500);

    const { data: row } = await service.from("swipe_transcriptions").select("id, video_url").eq("id", transcriptionId).maybeSingle();
    if (!row) return json({ error: "Transcrição não encontrada" }, 404);
    if (!row.video_url) return json({ error: "Sem vídeo para sincronizar." }, 400);

    const segments = await elevenLabsFromUrl(row.video_url, "video/mp4", EL);
    await service.from("swipe_transcriptions").update({ segments }).eq("id", transcriptionId);

    return json({ ok: true, segments });
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
