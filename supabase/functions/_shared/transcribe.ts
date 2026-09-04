// Transcrição compartilhada: OpenAI Whisper (rápido, padrão) e ElevenLabs Scribe
// (word-level, usado para "Sincronizar legenda com vídeo").

// Chave GLOBAL do ElevenLabs: configurada pela aba de Configurações e guardada em
// global_settings. Lida aqui via service role (o cliente nunca vê a chave). Faz
// fallback pro secret ELEVENLABS_API_KEY enquanto a chave não for setada pela UI.
export async function getElevenLabsKey(service: {
  from: (t: string) => any;
}): Promise<string | undefined> {
  try {
    const { data } = await service
      .from("global_settings")
      .select("elevenlabs_api_key")
      .eq("id", "singleton")
      .maybeSingle();
    if (data?.elevenlabs_api_key) return data.elevenlabs_api_key as string;
  } catch (_) { /* tabela pode não existir ainda — cai no fallback */ }
  return Deno.env.get("ELEVENLABS_API_KEY") || undefined;
}

export interface Segment { text: string; start: number; end: number; }
interface Word { text: string; start: number; end: number; type?: string; }

const MAX_WORDS_PER_SEGMENT = 8;
const MAX_SEGMENT_DURATION = 4.0;
const PAUSE_BREAK_THRESHOLD = 0.45;

// Agrupa palavras (ElevenLabs) em segmentos curtos estilo legenda.
export function groupWordsIntoSegments(words: Word[]): Segment[] {
  const speech = words.filter(
    (w) => w && typeof w.text === "string" && w.text.trim() &&
      Number.isFinite(w.start) && Number.isFinite(w.end) &&
      (w.type === undefined || w.type === "word"),
  );
  const segments: Segment[] = [];
  let bucket: Word[] = [];
  const flush = () => {
    if (!bucket.length) return;
    const text = bucket.map((w) => w.text).join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
    segments.push({ text, start: bucket[0].start, end: bucket[bucket.length - 1].end });
    bucket = [];
  };
  for (let i = 0; i < speech.length; i++) {
    const w = speech[i];
    bucket.push(w);
    const duration = w.end - bucket[0].start;
    const next = speech[i + 1];
    const gapToNext = next ? next.start - w.end : Infinity;
    const endsSentence = /[.!?…]$/.test(w.text.trim());
    const endsClause = /[,;:]$/.test(w.text.trim());
    if (endsSentence || bucket.length >= MAX_WORDS_PER_SEGMENT || duration >= MAX_SEGMENT_DURATION ||
        gapToNext >= PAUSE_BREAK_THRESHOLD || (endsClause && bucket.length >= 4)) flush();
  }
  flush();
  return segments;
}

// ── OpenAI Whisper (rápido) — recebe os bytes do arquivo (limite ~25 MB). ──
export async function transcribeWithOpenAI(bytes: Uint8Array, mimeType: string, ext: string, apiKey: string): Promise<Segment[]> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType || "video/mp4" }), `media.${ext}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("language", "pt");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const segs = Array.isArray(data?.segments) ? data.segments : [];
  return segs
    .map((s: any) => ({ text: (s.text || "").trim(), start: Number(s.start), end: Number(s.end) }))
    .filter((s: Segment) => s.text && Number.isFinite(s.start) && Number.isFinite(s.end));
}

const extFor = (mt: string) => mt.includes("webm") ? "webm" : mt.includes("ogg") ? "ogg" : mt.includes("quicktime") ? "mov" : "mp4";

// ── ElevenLabs Scribe (word-level) — recebe um stream do arquivo (memory-safe). ──
export async function elevenLabsFromStream(bodyStream: ReadableStream<Uint8Array>, mimeType: string, apiKey: string): Promise<Segment[]> {
  const mt = mimeType || "video/mp4";
  const ext = extFor(mt);
  const boundary = "----scaleform" + crypto.randomUUID().replace(/-/g, "");
  const enc = new TextEncoder();
  const field = (name: string, value: string) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  const preamble = enc.encode(
    field("model_id", "scribe_v2") + field("language_code", "por") + field("diarize", "false") + field("tag_audio_events", "false") +
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="media.${ext}"\r\nContent-Type: ${mt}\r\n\r\n`,
  );
  const epilogue = enc.encode(`\r\n--${boundary}--\r\n`);
  const reader = bodyStream.getReader();
  let sentPreamble = false, fileDone = false;
  const uploadBody = new ReadableStream({
    async pull(controller) {
      if (!sentPreamble) { controller.enqueue(preamble); sentPreamble = true; return; }
      if (fileDone) { controller.enqueue(epilogue); controller.close(); return; }
      const { done, value } = await reader.read();
      if (done) { fileDone = true; return; }
      controller.enqueue(value);
    },
    cancel(reason) { reader.cancel(reason).catch(() => {}); },
  });
  const elRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: uploadBody,
    // @ts-ignore duplex é válido em runtime, ausente nos tipos DOM.
    duplex: "half",
  });
  if (!elRes.ok) throw new Error(`ElevenLabs ${elRes.status}: ${(await elRes.text()).slice(0, 300)}`);
  const data = await elRes.json();
  const words: Word[] = Array.isArray(data?.words) ? data.words : [];
  return groupWordsIntoSegments(words);
}

// ElevenLabs a partir de uma URL (faz o fetch + stream). Usado no botão de sincronizar.
export async function elevenLabsFromUrl(videoUrl: string, mimeType: string, apiKey: string): Promise<Segment[]> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  const mt = mimeType || res.headers.get("content-type") || "video/mp4";
  return elevenLabsFromStream(res.body!, mt, apiKey);
}
