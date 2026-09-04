import { supabase } from "@/integrations/supabase/client";

/**
 * Sends a Telegram notification when a task is assigned to someone.
 * Fires and forgets — does not block the UI.
 */
export function notifyTelegramAssignment(taskName: string, assignedToId: string, projectId: string) {
  supabase.functions
    .invoke("notify-telegram", {
      body: {
        type: "assignment",
        task_name: taskName,
        assigned_to_id: assignedToId,
        project_id: projectId,
      },
    })
    .catch(() => {
      // Silent fail — Telegram notification is best-effort
    });
}

/**
 * Sends a Telegram notification to all master/owner members when a task is completed.
 * Fires and forgets — does not block the UI.
 */
export function notifyTelegramTaskCompleted(taskName: string, projectId: string) {
  supabase.functions
    .invoke("notify-telegram", {
      body: {
        type: "task_completed",
        task_name: taskName,
        project_id: projectId,
      },
    })
    .catch(() => {
      // Silent fail — Telegram notification is best-effort
    });
}
