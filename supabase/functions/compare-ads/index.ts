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

    const { validated_ads, analyze_ads } = await req.json();

    if (!validated_ads?.length || !analyze_ads?.length) {
      return new Response(JSON.stringify({ error: "Selecione pelo menos 1 anúncio validado e 1 para analisar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formatAd = (ad: any) => `Nome: ${ad.ad_name}
  Campanha: ${ad.campaign_name}
  Conjunto: ${ad.adset_name}
  Resultados: ${ad.results ?? 0}
  Custo/Resultado: ${ad.cost_per_result ?? 0}
  Valor Usado: ${ad.spend ?? 0}
  Custo/Checkout: ${ad.cost_per_initiated_checkout ?? 0}
  Conv. Checkout: ${ad.conv_checkout ?? 0}%
  Conv. Página: ${ad.conv_page ?? 0}%
  Taxa LP/Cliques: ${ad.lp_view_rate ?? 0}%
  CPM: ${ad.cpm ?? 0}
  CPC: ${ad.cpc ?? 0}
  Hook Rate: ${ad.hook_rate ?? 0}%
  Hold Rate: ${ad.hold_rate ?? 0}%`;

    const validatedText = validated_ads.map((a: any, i: number) => `--- Validado ${i + 1} ---\n${formatAd(a)}`).join("\n\n");
    const analyzeText = analyze_ads.map((a: any, i: number) => `--- Para Análise ${i + 1} ---\n${formatAd(a)}`).join("\n\n");

    const systemPrompt = `Você é um analista de Meta Ads. O usuário vai enviar dois grupos de anúncios:
1. VALIDADOS — benchmark/referência.
2. PARA ANÁLISE — anúncios a comparar.

INSTRUÇÕES RÍGIDAS — siga EXATAMENTE este formato, sem adicionar NADA além disso:

Para CADA anúncio "para análise", gere APENAS:

### [Nome do Anúncio]

| Métrica | Média Validados | Este Anúncio | Diferença | Status |
|---|---|---|---|---|
(uma linha por métrica não-zerada)

Onde:
- "Média Validados" = média aritmética dos validados para aquela métrica
- "Diferença" = variação percentual (ex: +25% ou -10%)
- "Status" = ✅ se igual ou melhor que o benchmark, ⚠️ se pior
- Para métricas de custo (CPM, CPC, Custo/Resultado, Custo/Checkout): menor é melhor
- Para métricas de taxa/conversão (Conv. Checkout, Conv. Página, LP View Rate, Hook Rate, Hold Rate, Resultados): maior é melhor
- Ignore métricas zeradas em AMBOS os lados
- Use valores formatados (R$ para valores monetários, % para taxas)

NÃO inclua:
- Introdução ou saudação
- Resumo final
- Recomendações
- Comentários ou parágrafos explicativos
- Qualquer texto fora das tabelas

APENAS as tabelas, uma por anúncio.`;

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
          { role: "user", content: `## Anúncios Validados (benchmark)\n\n${validatedText}\n\n## Anúncios Para Análise\n\n${analyzeText}` },
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
    console.error("compare-ads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
