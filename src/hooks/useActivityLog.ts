import { supabase } from "@/integrations/supabase/client";

export async function logActivity(params: {
  action: string;
  entity_type: string;
  entity_name: string;
  details?: string;
  entity_id?: string;
  project_id?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("activity_log" as any).insert({
    user_id: user.id,
    project_id: params.project_id || null,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id || null,
    entity_name: params.entity_name,
    details: params.details || "",
  });
}
