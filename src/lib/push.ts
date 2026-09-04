import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS only allows push when the site is installed to the Home Screen (standalone).
export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  needsInstall: boolean; // iOS not installed to home screen
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false, needsInstall: isIos() && !isStandalone() };
  }
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!sub,
    needsInstall: isIos() && !isStandalone(),
  };
}

export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!isPushSupported()) return { ok: false, error: "Push não é suportado neste navegador." };
    if (!VAPID_PUBLIC_KEY) return { ok: false, error: "Chave VAPID não configurada." };
    if (isIos() && !isStandalone()) {
      return { ok: false, error: "No iPhone, instale o app na tela de início primeiro (compartilhar → Adicionar à Tela de Início)." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Permissão de notificação negada." };
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sessão expirada." };

    const { error } = await (supabase as any).from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false, error: "Erro ao salvar a inscrição." };

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao ativar notificações." };
  }
}

export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await (supabase as any).from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Falha ao desativar." };
  }
}
