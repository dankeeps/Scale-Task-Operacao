import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioLines, Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Status {
  is_set: boolean;
  hint: string | null;
  updated_at: string | null;
}

// Chave GLOBAL do ElevenLabs (usada por todos os projetos nas transcrições).
// O cliente só grava e vê o status — nunca lê a chave crua (isso fica nas RPCs).
export function ElevenLabsKeyCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_elevenlabs_key_status");
    setLoading(false);
    if (error) { setStatus({ is_set: false, hint: null, updated_at: null }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setStatus(row ?? { is_set: false, hint: null, updated_at: null });
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const save = async () => {
    const key = value.trim();
    if (!key) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_elevenlabs_key", { _key: key });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar a chave"); return; }
    setValue("");
    toast.success("Chave do ElevenLabs salva! Vale para todos os projetos.");
    fetchStatus();
  };

  const remove = async () => {
    setSaving(true);
    const { error } = await (supabase as any).rpc("set_elevenlabs_key", { _key: "" });
    setSaving(false);
    if (error) { toast.error("Erro ao remover a chave"); return; }
    toast.success("Chave removida.");
    fetchStatus();
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <AudioLines className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-foreground">ElevenLabs (transcrição)</span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
        ) : status?.is_set ? (
          <Badge variant="secondary" className="ml-auto text-2xs border-0 bg-green-500/15 text-green-700 dark:text-green-400 gap-1">
            <Check className="h-3 w-3" /> Configurada{status.hint ? ` ••••${status.hint}` : ""}
          </Badge>
        ) : (
          <Badge variant="secondary" className="ml-auto text-2xs border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Não configurada
          </Badge>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground leading-snug">
        Chave <strong>global</strong> — todos os usuários e projetos usam esta chave nas transcrições
        (OpenAI é o padrão; o ElevenLabs entra em vídeos grandes e no botão "Sincronizar legenda").
      </p>

      <div className="flex gap-1.5">
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={status?.is_set ? "Colar nova chave para substituir" : "Colar a chave do ElevenLabs"}
          className="h-7 text-xs bg-secondary/30 border-border/50 flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
        />
        <Button size="sm" className="h-7 text-xs px-2 shrink-0" disabled={saving || !value.trim()} onClick={save}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
        </Button>
        {status?.is_set && (
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" disabled={saving} onClick={remove} title="Remover chave">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
