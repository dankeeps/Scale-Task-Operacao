import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { useFlows, Flow } from "@/hooks/useFlows";
import { CreateFlowDialog } from "./CreateFlowDialog";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; name: string }[];
  onFlowStarted: () => void;
}

export function FlowDialog({ open, onOpenChange, projects, onFlowStarted }: FlowDialogProps) {
  const { flows, loading, refetch } = useFlows();
  const [showCreate, setShowCreate] = useState(false);
  const [bulkAssignFlow, setBulkAssignFlow] = useState<Flow | null>(null);
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [bulkAssignments, setBulkAssignments] = useState<Record<number, string>>({});
  const [bulkMembers, setBulkMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Fetch members when bulk project changes
  useEffect(() => {
    if (!bulkProjectId) { setBulkMembers([]); setBulkAssignments({}); return; }
    (async () => {
      const { data: ups } = await supabase.from("user_projects").select("user_id").eq("project_id", bulkProjectId);
      if (!ups || ups.length === 0) { setBulkMembers([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ups.map((u) => u.user_id));
      setBulkMembers(profiles ?? []);
    })();
  }, [bulkProjectId]);

  const handleDelete = async (flowId: string) => {
    const { error } = await supabase.from("flows").delete().eq("id", flowId);
    if (error) {
      toast.error("Erro ao excluir flow");
      return;
    }
    toast.success("Flow excluído");
    refetch();
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignFlow || !bulkProjectId) return;
    const allAssigned = bulkAssignFlow.steps.every((_, i) => bulkAssignments[i]);
    if (!allAssigned) { toast.error("Atribua um responsável para cada tarefa"); return; }
    setBulkSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBulkSaving(false); return; }

    // Create flow instance
    const { data: instance, error: instError } = await supabase
      .from("flow_instances")
      .insert({
        flow_id: bulkAssignFlow.id,
        project_id: bulkProjectId,
        current_step_index: 0,
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (instError || !instance) {
      toast.error("Erro ao iniciar flow");
      setBulkSaving(false);
      return;
    }

    // Store all step assignments in the flow instance
    const stepAssignments: Record<string, string> = {};
    bulkAssignFlow.steps.forEach((_, i) => {
      stepAssignments[String(i)] = bulkAssignments[i];
    });

    await supabase
      .from("flow_instances")
      .update({ step_assignments: stepAssignments } as any)
      .eq("id", instance.id);

    // Create ONLY the first task
    const firstStep = bulkAssignFlow.steps[0];
    const { error: taskError } = await supabase.from("tasks").insert({
      project_id: bulkProjectId,
      name: firstStep.name,
      description: `Flow: ${bulkAssignFlow.name} — Tarefa 1/${bulkAssignFlow.steps.length}`,
      assigned_to: bulkAssignments[0],
      created_by: user.id,
      status: "pendente" as const,
      flow_instance_id: instance.id,
      flow_step_index: 0,
    });

    setBulkSaving(false);
    if (taskError) {
      toast.error("Erro ao criar tarefa");
    } else {
      toast.success(`Flow iniciado! Primeira tarefa: ${firstStep.name}`);
    }
    setBulkAssignFlow(null);
    setBulkProjectId("");
    setBulkAssignments({});
    onFlowStarted();
  };

  return (
    <>
      <Dialog open={open && !showCreate && !bulkAssignFlow} onOpenChange={onOpenChange}>
        <DialogContent className="glass border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Flows</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              size="sm"
              className="text-2xs h-7 gap-1 w-full"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-3 w-3" />
              Criar Flow
            </Button>

            {loading ? (
              <p className="text-2xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : flows.length === 0 ? (
              <p className="text-2xs text-muted-foreground text-center py-8">Nenhum flow criado</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => setBulkAssignFlow(flow)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-2xs font-medium text-foreground truncate">{flow.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {flow.steps.length} tarefa{flow.steps.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {flow.steps.map((step, i) => (
                          <Badge
                            key={step.id}
                            variant="outline"
                            className="text-[9px] px-1 py-0 border-border/50 text-muted-foreground"
                          >
                            {i + 1}. {step.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(flow.id); }}
                        title="Excluir flow"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk assign dialog - per task */}
      {bulkAssignFlow && (
        <Dialog open={!!bulkAssignFlow} onOpenChange={(v) => !v && setBulkAssignFlow(null)}>
          <DialogContent className="glass border-border/50 sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium">Atribuir tarefas: {bulkAssignFlow.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-2xs">Projeto</Label>
                <Select value={bulkProjectId} onValueChange={setBulkProjectId}>
                  <SelectTrigger className="text-2xs h-8 mt-1">
                    <SelectValue placeholder="Selecione o projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-2xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {bulkProjectId && (
                <div className="space-y-3">
                  <Label className="text-2xs text-muted-foreground">Responsável por tarefa</Label>
                  {bulkAssignFlow.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-2xs font-medium text-foreground truncate">
                          <span className="text-muted-foreground">{i + 1}.</span> {step.name}
                        </p>
                      </div>
                      <Select
                        value={bulkAssignments[i] || ""}
                        onValueChange={(v) => setBulkAssignments((prev) => ({ ...prev, [i]: v }))}
                      >
                        <SelectTrigger className="text-2xs h-7 w-36 shrink-0">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {bulkMembers.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-2xs">{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full text-2xs h-8"
                onClick={handleBulkAssign}
                disabled={bulkSaving || !bulkProjectId || !bulkAssignFlow.steps.every((_, i) => bulkAssignments[i])}
              >
                {bulkSaving ? "Iniciando..." : "Iniciar Flow"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <CreateFlowDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => {
          setShowCreate(false);
          refetch();
        }}
      />

    </>
  );
}
