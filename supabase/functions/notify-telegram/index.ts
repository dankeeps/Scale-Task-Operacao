import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type = "assignment", task_name, assigned_to_id, project_id } = body;

    if (!task_name || !project_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the project's telegram_bot_token
    const { data: project } = await supabase
      .from("projects")
      .select("telegram_bot_token, name")
      .eq("id", project_id)
      .single();

    if (!project?.telegram_bot_token) {
      return new Response(
        JSON.stringify({ ok: false, reason: "No telegram_bot_token for project" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "task_completed") {
      // Notify all master and owner members of the project
      const { data: members } = await supabase
        .from("user_projects")
        .select("user_id, role")
        .eq("project_id", project_id)
        .in("role", ["master", "owner"]);

      if (!members || members.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, reason: "No master/owner members found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, telegram_chat_id")
        .in("id", userIds)
        .not("telegram_chat_id", "is", null);

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, reason: "No members with telegram_chat_id" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const message = `✅ Tarefa "${task_name}" foi concluída`;
      const telegramUrl = `https://api.telegram.org/bot${project.telegram_bot_token}/sendMessage`;

      const results = await Promise.allSettled(
        profiles.map((p) =>
          fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: p.telegram_chat_id,
              text: message,
              parse_mode: "HTML",
            }),
          }).then((r) => r.json())
        )
      );

      return new Response(
        JSON.stringify({ ok: true, sent: results.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: assignment notification
    if (!assigned_to_id) {
      return new Response(
        JSON.stringify({ error: "Missing assigned_to_id for assignment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("telegram_chat_id, full_name")
      .eq("id", assigned_to_id)
      .single();

    if (!profile?.telegram_chat_id) {
      return new Response(
        JSON.stringify({ ok: false, reason: "No telegram_chat_id for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = `📋 Tarefa "${task_name}" - Atribuída a você`;
    const telegramUrl = `https://api.telegram.org/bot${project.telegram_bot_token}/sendMessage`;

    const tgResponse = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegram_chat_id,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const tgResult = await tgResponse.json();

    return new Response(
      JSON.stringify({ ok: tgResult.ok, description: tgResult.description }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
