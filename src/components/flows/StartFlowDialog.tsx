import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flow } from "@/hooks/useFlows";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

interface StartFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: Flow;
  projects: { id: string; name: string }[];
  onStarted: () => void;
}

export function StartFlowDialog({ open, onOpenChange, flow, projects, onStarted }: StartFlowDialogProps) {
  const [projectId, setProjectId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [starting, setStarting] = useState(false);

  // Fetch members when project changes
  useEffect(() => {
    if (!projectId) {
      setMembers([]);
      setAssignedTo("");
      return;
    }
    const fetchMembers = async () => {
      const { data: ups } = await supabase
        .from("user_projects")
        .select("user_id")
        .eq("project_id", projectId);
      if (!ups || ups.length === 0) { setMembers([]); return; }
      const userIds = ups.map((u) => u.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      setMembers(profiles ?? []);
    };
    fetchMembers();
  }, [projectId]);

  const firstStep = flow.steps.length > 0 ? flow.steps[0] : null;

  const handleStart = async () => {
    if (!projectId) { toast.error("Selecione um projeto"); return; }
    if (!assignedTo) { toast.error("Selecione um responsável"); return; }
    if (!firstStep) return;

    setStarting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStarting(false); return; }

    // Create flow instance
    const { data: instance, error: instError } = await supabase
      .from("flow_instances")
      .insert({
        flow_id: flow.id,
        project_id: projectId,
        current_step_index: 0,
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (instError || !instance) {
      toast.error("Erro ao iniciar flow");
      setStarting(false);
      return;
    }

    // Create first task
    const { error: taskError } = await supabase.from("tasks").insert({
      project_id: projectId,
      name: firstStep.name,
      description: `Flow: ${flow.name} — Tarefa ${1}/${flow.steps.length}`,
      assigned_to: assignedTo,
      created_by: user.id,
      status: "pendente" as const,
      flow_instance_id: instance.id,
      flow_step_index: 0,
    });

    setStarting(false);
    if (taskError) {
      toast.error("Erro ao criar primeira tarefa");
      return;
    }

    toast.success(`Flow "${flow.name}" iniciado!`);
    setProjectId("");
    setAssignedTo("");
    onStarted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">Iniciar Flow: {flow.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Steps preview */}
          <div>
            <Label className="text-2xs text-muted-foreground">Etapas do flow</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {flow.steps.map((step, i) => (
                <Badge
                  key={step.id}
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 border ${
                    i === 0 ? "bg-primary/20 text-primary border-primary/30" : "border-border/50 text-muted-foreground"
                  }`}
                >
                  {i + 1}. {step.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Project select */}
          <div>
            <Label className="text-2xs">Qual projeto?</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="text-2xs h-8 mt-1">
                <SelectValue placeholder="Selecione o projeto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-2xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee for first task */}
          {firstStep && projectId && (
            <div>
              <Label className="text-2xs">
                Responsável por: <span className="text-primary">{firstStep.name}</span>
              </Label>
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
          )}

          <Button
            className="w-full text-2xs h-8"
            onClick={handleStart}
            disabled={starting || !projectId || !assignedTo}
          >
            {starting ? "Iniciando..." : "Iniciar Flow"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
