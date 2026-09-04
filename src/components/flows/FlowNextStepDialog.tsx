import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyTelegramAssignment } from "@/lib/notifyTelegram";

interface FlowNextStepDialogProps {
  open: boolean;
  onClose: () => void;
  flowInstanceId: string;
  currentStepIndex: number;
  projectId: string;
  onCompleted: () => void;
}

export function FlowNextStepDialog({
  open,
  onClose,
  flowInstanceId,
  currentStepIndex,
  projectId,
  onCompleted,
}: FlowNextStepDialogProps) {
  const [nextStep, setNextStep] = useState<{ name: string; order_number: number } | null>(null);
  const [flowName, setFlowName] = useState("");
  const [totalSteps, setTotalSteps] = useState(0);
  const [assignedTo, setAssignedTo] = useState("");
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [isLastStep, setIsLastStep] = useState(false);

  useEffect(() => {
    if (!open || !flowInstanceId) return;

    const fetchData = async () => {
      // Get flow instance to find flow_id
      const { data: instance } = await supabase
        .from("flow_instances")
        .select("flow_id")
        .eq("id", flowInstanceId)
        .single();

      if (!instance) return;

      // Get flow name
      const { data: flow } = await supabase
        .from("flows")
        .select("name")
        .eq("id", instance.flow_id)
        .single();

      if (flow) setFlowName(flow.name);

      // Get all steps
      const { data: steps } = await supabase
        .from("flow_steps")
        .select("*")
        .eq("flow_id", instance.flow_id)
        .order("order_number", { ascending: true });

      if (!steps) return;
      setTotalSteps(steps.length);

      const nextIdx = currentStepIndex + 1;
      if (nextIdx >= steps.length) {
        setIsLastStep(true);
        setNextStep(null);
      } else {
        setIsLastStep(false);
        setNextStep(steps[nextIdx]);
      }

      // Fetch members
      const { data: ups } = await supabase
        .from("user_projects")
        .select("user_id")
        .eq("project_id", projectId);

      if (ups && ups.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ups.map((u) => u.user_id));
        setMembers(profiles ?? []);
      }
    };
    fetchData();
  }, [open, flowInstanceId, currentStepIndex, projectId]);

  const handleConfirm = async () => {
    if (isLastStep) {
      // Mark flow instance as completed
      await supabase
        .from("flow_instances")
        .update({ status: "completed", current_step_index: currentStepIndex })
        .eq("id", flowInstanceId);
      toast.success(`Flow "${flowName}" concluído!`);
      onClose();
      onCompleted();
      return;
    }

    if (!assignedTo) {
      toast.error("Selecione um responsável");
      return;
    }
    if (!nextStep) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const nextIdx = currentStepIndex + 1;

    // Update flow instance
    await supabase
      .from("flow_instances")
      .update({ current_step_index: nextIdx })
      .eq("id", flowInstanceId);

    // Create next task
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      name: nextStep.name,
      description: `Flow: ${flowName} — Tarefa ${nextIdx + 1}/${totalSteps}`,
      assigned_to: assignedTo,
      created_by: user?.id || null,
      status: "pendente" as const,
      flow_instance_id: flowInstanceId,
      flow_step_index: nextIdx,
    });

    setSaving(false);
    if (error) {
      toast.error("Erro ao criar próxima tarefa");
      return;
    }

    toast.success(`Próxima etapa: ${nextStep.name}`);
    if (assignedTo) {
      notifyTelegramAssignment(nextStep.name, assignedTo, projectId);
    }
    setAssignedTo("");
    onClose();
    onCompleted();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass border-border/50 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {isLastStep ? "Flow Concluído!" : "Próxima etapa do Flow"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-2xs text-muted-foreground">Flow: <span className="text-foreground">{flowName}</span></p>
          </div>

          {isLastStep ? (
            <div className="text-center py-4">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-2xs">
                Todas as etapas foram concluídas!
              </Badge>
            </div>
          ) : nextStep ? (
            <>
              <div>
                <Label className="text-2xs">Próxima tarefa</Label>
                <Badge
                  variant="outline"
                  className="text-2xs px-2 py-0.5 mt-1 block w-fit bg-primary/10 text-primary border-primary/30"
                >
                  {currentStepIndex + 2}. {nextStep.name}
                </Badge>
              </div>

              <div>
                <Label className="text-2xs">Atribuir a</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="text-2xs h-8 mt-1">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-2xs">
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <Button
            className="w-full text-2xs h-8"
            onClick={handleConfirm}
            disabled={saving || (!isLastStep && !assignedTo)}
          >
            {isLastStep ? "Finalizar Flow" : saving ? "Criando..." : "Confirmar e Avançar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
