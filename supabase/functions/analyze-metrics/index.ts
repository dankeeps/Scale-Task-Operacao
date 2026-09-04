import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require a valid user JWT — this endpoint spends LLM credits.
    const auth = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: authData } = auth ? await admin.auth.getUser(auth) : { data: null };
    if (!authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { metrics } = await req.json();

    if (!metrics || !Array.isArray(metrics) || metrics.length < 2) {
      return new Response(JSON.stringify({ error: "Selecione pelo menos 2 métricas." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const metricsText = metrics
      .map((m: any, i: number) => {
        const period = m.date_from && m.date_to ? `${m.date_from} a ${m.date_to}` : "Sem período";
        const offer = m.offer_name || "Sem oferta";
        return `--- Métrica ${i + 1} (${period} | Oferta: ${offer}) ---
Investimento: R$ ${m.investimento ?? 0}
Faturamento: R$ ${m.faturamento ?? 0}
ROAS: ${m.roas ?? 0}
CPA: R$ ${m.cpa ?? 0}
CPM: R$ ${m.cpm ?? 0}
CPC: R$ ${m.cpc ?? 0}
Conv. PV: ${m.conversao_pv ?? 0}%
Conv. Checkout: ${m.conv_checkout ?? 0}%
Body Conv.: ${m.body_conv ?? 0}%
Connect Rate: ${m.connect_rate ?? 0}%
Custo por IC: R$ ${m.custo_por_ic ?? 0}
Hook Rate: ${m.hook_rate ?? 0}%
Hold Rate: ${m.hold_rate ?? 0}%
Play Rate: ${m.play_rate ?? 0}%
Ret. 1º min: ${m.retencao_primeiro_minuto ?? 0}%
Ret. Pitch: ${m.retencao_pitch ?? 0}%
Conversão Vturb: ${m.conversao_vturb ?? 0}%`;
      })
      .join("\n\n");

    const systemPrompt = `Você é um analista de tráfego pago e performance digital. O usuário vai te enviar dados de métricas de diferentes períodos/ofertas. Faça uma análise comparativa clara e objetiva em português brasileiro. 

Regras:
- Compare os períodos destacando melhores e piores resultados
- Identifique tendências (CPA subindo/caindo, ROAS melhorando, etc.)
- Use emojis para facilitar a leitura (📈 📉 ✅ ⚠️ 🔥)
- Formate com markdown (títulos, negrito, listas)
- Dê insights acionáveis ao final (o que manter, o que ajustar)
- Seja direto e prático, sem enrolação
- Ignore métricas zeradas na análise`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise comparativamente estas métricas:\n\n${metricsText}` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao conectar com a IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-metrics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
