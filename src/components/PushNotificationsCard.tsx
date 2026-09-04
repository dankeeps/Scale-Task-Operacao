import { useEffect, useState } from "react";
import { Bell, Loader2, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getPushStatus, enablePush, disablePush, type PushStatus } from "@/lib/push";

export function PushNotificationsCard() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => getPushStatus().then(setStatus);

  useEffect(() => { refresh(); }, []);

  const onToggle = async (next: boolean) => {
    setBusy(true);
    const res = next ? await enablePush() : await disablePush();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível alterar as notificações.");
    } else {
      toast.success(next ? "Notificações ativadas neste aparelho!" : "Notificações desativadas.");
    }
    refresh();
  };

  if (!status) return null;

  const unsupported = !status.supported;
  const needsInstall = status.needsInstall;
  const denied = status.permission === "denied";
  const enabled = status.subscribed && status.permission === "granted";
  const disabledSwitch = busy || unsupported || needsInstall || denied;

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Notificações no aparelho</p>
            <p className="text-2xs text-muted-foreground">Avisar quando uma tarefa for atribuída a você</p>
          </div>
        </div>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        ) : (
          <Switch checked={enabled} disabled={disabledSwitch} onCheckedChange={onToggle} />
        )}
      </div>

      {needsInstall && (
        <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
          <Smartphone className="h-3 w-3 mt-0.5 shrink-0" />
          No iPhone, primeiro instale o app: toque em Compartilhar → “Adicionar à Tela de Início”, abra pelo ícone e volte aqui.
        </p>
      )}
      {denied && (
        <p className="text-2xs text-muted-foreground">
          As notificações estão bloqueadas nas configurações do navegador para este site. Libere-as e tente de novo.
        </p>
      )}
      {unsupported && !needsInstall && (
        <p className="text-2xs text-muted-foreground">Este navegador não suporta notificações push.</p>
      )}
    </div>
  );
}
