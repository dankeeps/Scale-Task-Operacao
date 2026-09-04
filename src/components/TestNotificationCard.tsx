import { useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string;
}

export function TestNotificationCard() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name", { ascending: true });
      setUsers((data as Profile[]) || []);
    })();
  }, []);

  const send = async () => {
    if (!target) return;
    setSending(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: target,
      title: "🔔 Notificação de teste",
      message: "Esta é uma notificação de teste enviada das Configurações.",
    } as any);
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar a notificação de teste.");
    } else {
      toast.success("Enviada! Se o usuário ativou as notificações no aparelho, o push deve chegar.");
    }
  };

  const nameFor = (u: Profile) => {
    const base = u.full_name?.trim() || u.id.slice(0, 8);
    return u.id === meId ? `${base} (você)` : base;
  };

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Testar notificação</p>
          <p className="text-2xs text-muted-foreground">Enviar uma notificação de teste a um usuário</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-2xs">Usuário</Label>
        <div className="flex gap-2">
          <Select value={target ?? undefined} onValueChange={setTarget}>
            <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50 flex-1">
              <SelectValue placeholder="Selecionar usuário" />
            </SelectTrigger>
            <SelectContent>
              {users.length === 0 ? (
                <div className="px-2 py-1.5 text-2xs text-muted-foreground">Nenhum usuário</div>
              ) : (
                users.map((u) => (
                  <SelectItem key={u.id} value={u.id} className="text-2xs">
                    {nameFor(u)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <button
            onClick={send}
            disabled={!target || sending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
