import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface StepDraft {
  id: string;
  name: string;
}

export function CreateFlowDialog({ open, onOpenChange, onCreated }: CreateFlowDialogProps) {
  const [flowName, setFlowName] = useState("");
  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "" },
    ]);
  };

  const updateStepName = (id: string, name: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setSteps((prev) => {
      const newSteps = [...prev];
      const [dragged] = newSteps.splice(dragIdx, 1);
      newSteps.splice(idx, 0, dragged);
      return newSteps;
    });
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const handleSave = async () => {
    if (!flowName.trim()) {
      toast.error("Digite o nome do flow");
      return;
    }
    if (steps.length === 0 || steps.some((s) => !s.name.trim())) {
      toast.error("Adicione e nomeie todas as tarefas");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: flow, error } = await supabase
      .from("flows")
      .insert({ name: flowName.trim(), created_by: user.id })
      .select("id")
      .single();

    if (error || !flow) {
      toast.error("Erro ao criar flow");
      setSaving(false);
      return;
    }

    const stepsToInsert = steps.map((s, i) => ({
      flow_id: flow.id,
      name: s.name.trim(),
      order_number: i + 1,
    }));

    const { error: stepsError } = await supabase.from("flow_steps").insert(stepsToInsert);

    setSaving(false);
    if (stepsError) {
      toast.error("Erro ao salvar tarefas do flow");
      return;
    }

    toast.success("Flow criado!");
    logActivity({
      action: "create",
      entity_type: "flow",
      entity_name: flowName.trim(),
      details: `criou o flow "${flowName.trim()}" com ${steps.length} etapa(s)`,
    });
    setFlowName("");
    setSteps([]);
    onCreated();
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setFlowName("");
      setSteps([]);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">Criar Flow</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-2xs">Nome do Flow</Label>
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Ex: Processo de criativo"
              className="text-2xs h-8 mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-2xs">Tarefas</Label>
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-6 gap-1"
                onClick={addStep}
              >
                <Plus className="h-2.5 w-2.5" />
                Adicionar tarefa
              </Button>
            </div>

            {steps.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">
                Nenhuma tarefa adicionada
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/50 transition-colors ${
                      dragIdx === idx ? "opacity-50 border-primary/50" : ""
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-4">
                      {idx + 1}
                    </span>
                    <Input
                      value={step.name}
                      onChange={(e) => updateStepName(step.id, e.target.value)}
                      placeholder={`Tarefa ${idx + 1}`}
                      className="text-2xs h-6 flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeStep(step.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            className="w-full text-2xs h-8"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar Flow"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
