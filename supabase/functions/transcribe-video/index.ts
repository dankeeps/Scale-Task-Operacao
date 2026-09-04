// Transcrição PADRÃO (rápida): OpenAI Whisper. Para arquivos acima de ~24 MB
// (limite do Whisper) cai automaticamente para o ElevenLabs (streaming).
// A sincronização fina word-level fica no botão "Sincronizar legenda" (sync-captions).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { transcribeWithOpenAI, elevenLabsFromStream, getElevenLabsKey, type Segment } from "../_shared/transcribe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_OPENAI = 24 * 1024 * 1024; // Whisper: limite ~25 MB, margem de segurança
const extFor = (mt: string) => mt.includes("webm") ? "webm" : mt.includes("ogg") ? "ogg" : mt.includes("quicktime") ? "mov" : "mp4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Auth: JWT do usuário OU service role (chamadas internas).
    const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const service = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!);
    let authorized = !!auth && !!serviceKey && auth === serviceKey;
    if (!authorized && auth) {
      const { data } = await service.auth.getUser(auth);
      authorized = !!data?.user;
    }
    if (!authorized) return json({ error: "Unauthorized" }, 401);

    const { videoUrl, mimeType } = await req.json();
    if (!videoUrl) return json({ error: "videoUrl is required" }, 400);

    const OPENAI = Deno.env.get("OPENAI_API_KEY");
    const EL = await getElevenLabsKey(service);

    const mediaRes = await fetch(videoUrl);
    if (!mediaRes.ok) return json({ error: `Failed to fetch media: ${mediaRes.status}` }, 400);
    const mt = mimeType || mediaRes.headers.get("content-type") || "video/mp4";
    const size = Number(mediaRes.headers.get("content-length")) || 0;

    let segments: Segment[] = [];
    let provider = "";

    // Rápido (OpenAI) quando o tamanho é conhecido e cabe no limite do Whisper.
    if (OPENAI && size > 0 && size <= MAX_OPENAI) {
      const bytes = new Uint8Array(await mediaRes.arrayBuffer());
      try {
        segments = await transcribeWithOpenAI(bytes, mt, extFor(mt), OPENAI);
        provider = "openai";
      } catch (e) {
        if (!EL) throw e;
        // Fallback: re-baixa e manda pro ElevenLabs (streaming).
        const re = await fetch(videoUrl);
        segments = await elevenLabsFromStream(re.body!, mt, EL);
        provider = "elevenlabs";
      }
    } else if (EL) {
      // Grande/desconhecido → ElevenLabs streaming (memory-safe).
      segments = await elevenLabsFromStream(mediaRes.body!, mt, EL);
      provider = "elevenlabs";
    } else if (OPENAI) {
      // Sem ElevenLabs: tenta OpenAI mesmo assim (pode falhar se for grande).
      const bytes = new Uint8Array(await mediaRes.arrayBuffer());
      segments = await transcribeWithOpenAI(bytes, mt, extFor(mt), OPENAI);
      provider = "openai";
    } else {
      return json({ error: "Nenhum provedor de transcrição configurado (OPENAI_API_KEY/ELEVENLABS_API_KEY)." }, 500);
    }

    return json({ segments, provider });
  } catch (e) {
    return json({ error: String(e).slice(0, 400) }, 500);
  }
});
