import { useState, useMemo, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logActivity } from "@/hooks/useActivityLog";
import { notifyTelegramAssignment, notifyTelegramTaskCompleted } from "@/lib/notifyTelegram";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { useTasks, Task } from "@/hooks/useTasks";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { ViewTaskDialog } from "@/components/tasks/ViewTaskDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, CalendarDays, Clock, FolderOpen, Trash2, Pencil, Palette, Archive, User, Workflow, ExternalLink, Zap, ChevronLeft, ChevronRight, LayoutGrid, ListTodo, Repeat } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isFuture, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, addMonths, subMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { AssignTaskDialog } from "@/components/tasks/AssignTaskDialog";
import { FlowDialog } from "@/components/flows/FlowDialog";
import type { Database } from "@/integrations/supabase/types";
import {
  CREATIVE_STEPS,
  CreativeStep,
  stepByLabel,
  nextStepByLabel,
  stepIndexByLabel,
  stepPromptsForDate,
} from "@/lib/creativeSteps";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

type View = "hoje" | "calendario" | "arquivados" | "proxima_tarefa" | string; // string = project id

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_progresso: "Em progresso",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  em_progresso: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  concluida: "bg-green-500/20 text-green-400 border-green-500/30",
  arquivada: "bg-muted text-muted-foreground border-border/50",
};

// Light mode: info tags become solid black/white and status badges solid+white,
// so they stay legible on the light gray surface.
const INFO_BADGE_LIGHT = "bg-neutral-900 text-white border-neutral-900";
const statusColorsLight: Record<string, string> = {
  pendente: "bg-amber-500 text-white border-amber-500",
  em_progresso: "bg-blue-500 text-white border-blue-500",
  concluida: "bg-green-600 text-white border-green-600",
  arquivada: "bg-neutral-500 text-white border-neutral-500",
};

interface UpcomingTask {
  id: string;
  type: "flow" | "criativo";
  name: string;
  description: string;
  project_name: string;
}

const TABS: { key: View; label: string; icon: typeof CalendarDays }[] = [
  { key: "hoje", label: "Hoje", icon: CalendarDays },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "proxima_tarefa", label: "Próxima tarefa", icon: Zap },
  { key: "arquivados", label: "Arquivados", icon: Archive },
  { key: "todas", label: "Todas", icon: ListTodo },
];

const Dashboard = () => {
  const { projects, currentProject } = useProjectContext();
  const { isFullAccess, canDelete } = useCurrentUserRole();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const allProjectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const { tasks, loading, refetch } = useTasks(allProjectIds);

  const [view, setView] = useState<View>("hoje");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [advancingTask, setAdvancingTask] = useState<Task | null>(null);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  // Concluding "Enviar copy para expert" → mandatory delivery date for the next task.
  const [datePromptTask, setDatePromptTask] = useState<Task | null>(null);
  const [promptDate, setPromptDate] = useState<Date | undefined>(undefined);
  const [dateWarn, setDateWarn] = useState(false);
  const [showFlows, setShowFlows] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const { members } = useProjectMembers();

  // Fetch current user id
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Auto-create next flow task from stored assignments
  const autoCreateNextFlowTask = async (flowInstanceId: string, currentStepIndex: number, projectId: string) => {
    const { data: instance } = await supabase
      .from("flow_instances")
      .select("flow_id, step_assignments")
      .eq("id", flowInstanceId)
      .single();

    if (!instance) return;

    const { data: steps } = await supabase
      .from("flow_steps")
      .select("*")
      .eq("flow_id", instance.flow_id)
      .order("order_number", { ascending: true });

    if (!steps) return;

    const nextIdx = currentStepIndex + 1;
    if (nextIdx >= steps.length) {
      // Flow completed
      await supabase
        .from("flow_instances")
        .update({ status: "completed", current_step_index: currentStepIndex })
        .eq("id", flowInstanceId);

      const { data: flow } = await supabase.from("flows").select("name").eq("id", instance.flow_id).single();
      toast.success(`Flow "${flow?.name || ""}" concluído!`);
      return;
    }

    const nextStep = steps[nextIdx];
    const assignments = (instance as any).step_assignments as Record<string, string> | null;
    const assignedTo = assignments?.[String(nextIdx)] || null;

    const { data: { user } } = await supabase.auth.getUser();

    // Update flow instance
    await supabase
      .from("flow_instances")
      .update({ current_step_index: nextIdx })
      .eq("id", flowInstanceId);

    // Create next task
    const { data: flow } = await supabase.from("flows").select("name").eq("id", instance.flow_id).single();
    await supabase.from("tasks").insert({
      project_id: projectId,
      name: nextStep.name,
      description: `Flow: ${flow?.name || ""} — Tarefa ${nextIdx + 1}/${steps.length}`,
      assigned_to: assignedTo,
      created_by: user?.id || null,
      status: "pendente" as const,
      flow_instance_id: flowInstanceId,
      flow_step_index: nextIdx,
    });

    if (assignedTo) {
      notifyTelegramAssignment(nextStep.name, assignedTo, projectId);
    }
    toast.success(`Próxima etapa: ${nextStep.name}`);
  };

  // Upcoming virtual tasks (not yet created) from Flows and Criativos

  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);

  useEffect(() => {
    if (!currentUserId || allProjectIds.length === 0) {
      setUpcomingTasks([]);
      return;
    }

    const fetchUpcoming = async () => {
      const upcoming: UpcomingTask[] = [];

      // 1) Flow upcoming: user is assigned to a future step
      const { data: activeInstances } = await supabase
        .from("flow_instances")
        .select("id, flow_id, current_step_index, step_assignments, project_id")
        .eq("status", "active")
        .in("project_id", allProjectIds);

      if (activeInstances && activeInstances.length > 0) {
        const flowIds = [...new Set(activeInstances.map((i) => i.flow_id))];
        const { data: flows } = await supabase.from("flows").select("id, name").in("id", flowIds);
        const flowMap = Object.fromEntries((flows ?? []).map((f) => [f.id, f.name]));

        const { data: allSteps } = await supabase
          .from("flow_steps")
          .select("id, flow_id, name, order_number")
          .in("flow_id", flowIds)
          .order("order_number", { ascending: true });

        const stepsByFlow: Record<string, typeof allSteps> = {};
        (allSteps ?? []).forEach((s) => {
          if (!stepsByFlow[s.flow_id]) stepsByFlow[s.flow_id] = [];
          stepsByFlow[s.flow_id]!.push(s);
        });

        const projMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

        for (const inst of activeInstances) {
          const assignments = inst.step_assignments as Record<string, string> | null;
          if (!assignments) continue;
          const steps = stepsByFlow[inst.flow_id] ?? [];

          for (const [stepIdx, userId] of Object.entries(assignments)) {
            const idx = parseInt(stepIdx);
            if (userId === currentUserId && idx > inst.current_step_index) {
              const step = steps[idx];
              if (step) {
                upcoming.push({
                  id: `flow-${inst.id}-${idx}`,
                  type: "flow",
                  name: step.name,
                  description: `Flow: ${flowMap[inst.flow_id] || ""} — Etapa ${idx + 1}/${steps.length}`,
                  project_name: projMap[inst.project_id] || "",
                });
              }
            }
          }
        }
      }

      // 2) Criativo upcoming: user is assigned to a future phase
      const { data: docs } = await supabase
        .from("creative_documents")
        .select("id, phase_assignments, project_id")
        .in("project_id", allProjectIds)
        .not("phase_assignments", "is", null);

      if (docs && docs.length > 0) {
        const docIds = docs.map((d) => d.id);
        const { data: ads } = await supabase
          .from("creative_ads")
          .select("id, document_id, name")
          .in("document_id", docIds);

        const projMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

        for (const doc of docs) {
          const assignments = doc.phase_assignments as Record<string, string> | null;
          if (!assignments) continue;

          const docAds = (ads ?? []).filter((a) => a.document_id === doc.id);

          for (const ad of docAds) {
            // Current progress = the furthest pipeline step that already has a task.
            const adTasks = tasks.filter((t) => t.ad_id === ad.id);
            let maxExistingIdx = -1;
            for (const t of adTasks) {
              const i = stepIndexByLabel(t.name);
              if (i > maxExistingIdx) maxExistingIdx = i;
            }

            for (const [stepKey, userId] of Object.entries(assignments)) {
              if (userId !== currentUserId) continue;
              const step = CREATIVE_STEPS.find((s) => s.key === stepKey);
              if (!step) continue;
              const stepIdx = CREATIVE_STEPS.findIndex((s) => s.key === stepKey);
              // A future step assigned to the user that hasn't been created yet.
              if (stepIdx > maxExistingIdx) {
                upcoming.push({
                  id: `criativo-${ad.id}-${stepKey}`,
                  type: "criativo",
                  name: `${step.label} — ${ad.name || "Anúncio"}`,
                  description: `Tarefa futura do criativo`,
                  project_name: projMap[doc.project_id] || "",
                });
              }
            }
          }
        }
      }

      setUpcomingTasks(upcoming);
    };

    fetchUpcoming();
  }, [currentUserId, allProjectIds.join(","), tasks]);

  // Count tasks in "próxima tarefa" for pulsing indicator
  const proximaTarefaCount = useMemo(() => {
    if (!currentUserId) return 0;
    return upcomingTasks.length;
  }, [tasks, currentUserId, upcomingTasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Exclude archived from all views except "arquivados"
    if (view !== "arquivados") {
      filtered = filtered.filter((t) => t.status !== "arquivada");
    }

    if (view === "hoje") {
      filtered = filtered.filter((t) => {
        if (!t.due_date) return false;
        return isToday(parseISO(t.due_date));
      });
    } else if (view === "calendario") {
      filtered = filtered.filter((t) => {
        if (!t.due_date) return false;
        const d = parseISO(t.due_date);
        return isFuture(d) && !isToday(d);
      });
    } else if (view === "arquivados") {
      filtered = filtered.filter((t) => t.status === "arquivada");
    } else if (view === "proxima_tarefa") {
      filtered = [];
    }

    if (projectFilter !== "all") {
      filtered = filtered.filter((t) => t.project_id === projectFilter);
    }

    if (onlyMine && currentUserId) {
      filtered = filtered.filter((t) => t.assigned_to === currentUserId);
    }

    return filtered;
  }, [tasks, view, onlyMine, currentUserId, projectFilter]);

  // Calendar tasks — show all non-archived tasks with a due date
  const calendarTasks = useMemo(() => {
    let filtered = tasks.filter((t) => {
      if (t.status === "arquivada") return false;
      if (!t.due_date) return false;
      return true;
    });

    if (projectFilter !== "all") {
      filtered = filtered.filter((t) => t.project_id === projectFilter);
    }

    if (onlyMine && currentUserId) {
      filtered = filtered.filter((t) => t.assigned_to === currentUserId);
    }

    return filtered;
  }, [tasks, projectFilter, onlyMine, currentUserId]);

  const calendarSelectedTasks = useMemo(() => {
    if (!calendarSelectedDate) return calendarTasks;
    return calendarTasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), calendarSelectedDate));
  }, [calendarTasks, calendarSelectedDate]);

  // Map of date string -> task count for dots
  const tasksByDate = useMemo(() => {
    const map: Record<string, number> = {};
    calendarTasks.forEach((t) => {
      if (t.due_date) {
        const key = t.due_date;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [calendarTasks]);

  // Create the next pipeline task for the same ad. All auto-tasks are high priority.
  const insertNextTask = async (
    task: Task,
    nextStep: CreativeStep,
    dueDate: string,
    assignedTo: string | null
  ) => {
    if (!task.ad_id) return;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("tasks").insert({
      project_id: task.project_id,
      ad_id: task.ad_id,
      name: nextStep.label,
      description: `Tarefa criada ao avançar para "${nextStep.label}".`,
      assigned_to: assignedTo,
      created_by: user?.id || null,
      status: "pendente" as const,
      priority: "alta",
      due_date: dueDate,
    } as any);

    if (error) {
      toast.error("Erro ao criar tarefa da próxima fase");
    } else {
      toast.success(`Avançado para "${nextStep.label}"!`);
      if (assignedTo) notifyTelegramAssignment(nextStep.label, assignedTo, task.project_id);
    }
    refetch();
  };

  // Tarefa recorrente concluída → cria a próxima ocorrência copiando todos os dados.
  // A próxima data é calculada SEMPRE a partir da data de vencimento agendada
  // (ritmo fixo), não da data em que foi concluída.
  const createNextRecurringTask = async (task: Task) => {
    const rec = task.recurrence;
    if (!rec || rec === "none" || !task.due_date) return;
    const base = parseISO(task.due_date);
    const nextDate = rec === "weekly" ? addDays(base, 7) : addMonths(base, 1);
    const nextDue = format(nextDate, "yyyy-MM-dd");
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("tasks").insert({
      project_id: task.project_id,
      name: task.name,
      description: task.description,
      assigned_to: task.assigned_to,
      created_by: user?.id || null,
      due_date: nextDue,
      offer_name: task.offer_name || "",
      link: task.link || "",
      folder_id: task.folder_id || null,
      file_name: task.file_name || "",
      priority: task.priority || "normal",
      directors_only: task.directors_only ?? false,
      recurrence: rec,
      status: "pendente" as const,
    } as any);

    if (error) {
      toast.error("Erro ao criar a próxima tarefa recorrente");
      return;
    }
    toast.success(`Próxima tarefa recorrente criada para ${format(nextDate, "dd/MM/yyyy", { locale: ptBR })}`);
    if (task.assigned_to) notifyTelegramAssignment(task.name, task.assigned_to, task.project_id);
  };

  // Look up the pre-assigned responsável for a step from the document's assignments.
  const getPreAssigned = async (adId: string, stepKey: string): Promise<string | null> => {
    const { data: ad } = await supabase
      .from("creative_ads").select("document_id").eq("id", adId).single();
    if (!ad) return null;
    const { data: doc } = await supabase
      .from("creative_documents").select("phase_assignments").eq("id", ad.document_id).single() as any;
    const phaseAssignments = doc?.phase_assignments as Record<string, string> | null;
    return phaseAssignments?.[stepKey] || null;
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    if (newStatus === "concluida") {
      const task = tasks.find((t) => t.id === taskId);

      // Check if this is a flow task
      if (task) {
        const { data: taskData } = await supabase
          .from("tasks")
          .select("flow_instance_id, flow_step_index")
          .eq("id", taskId)
          .single();

        if (taskData?.flow_instance_id != null && taskData?.flow_step_index != null) {
          // Mark current task as completed
          await supabase
            .from("tasks")
            .update({ status: "concluida" as const })
            .eq("id", taskId);
          notifyTelegramTaskCompleted(task.name, task.project_id);

          // Auto-create next task from stored assignments
          await autoCreateNextFlowTask(
            taskData.flow_instance_id,
            taskData.flow_step_index,
            task.project_id
          );
          refetch();
          return;
        }
      }

      // Check if this is a creative pipeline task (matches one of the 7 steps by name)
      if (task?.ad_id && stepByLabel(task.name)) {
        const next = nextStepByLabel(task.name);

        // "Enviar copy para expert": the next task ("Esperando entrega do expert")
        // needs a MANDATORY delivery due date. Defer completion until the user
        // picks the date in the popup (nothing is marked concluded yet).
        if (next && stepPromptsForDate(task.name)) {
          setPromptDate(undefined);
          setDateWarn(false);
          setDatePromptTask({ ...task, _nextStep: next } as any);
          return;
        }

        // Mark the current step complete.
        await supabase
          .from("tasks")
          .update({ status: "concluida" as const })
          .eq("id", taskId);
        notifyTelegramTaskCompleted(task.name, task.project_id);

        if (!next) {
          // Last step of the pipeline — nothing else to create.
          refetch();
          return;
        }

        // Otherwise the next task is due today. Auto-assign if pre-assigned, else ask.
        const today = format(new Date(), "yyyy-MM-dd");
        const preAssigned = await getPreAssigned(task.ad_id, next.key);
        if (preAssigned) {
          await insertNextTask(task, next, today, preAssigned);
        } else {
          setAdvancingTask({ ...task, _nextStep: next, _dueDate: today } as any);
          refetch();
        }
        return;
      }
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus as "pendente" | "em_progresso" | "concluida" | "arquivada" })
      .eq("id", taskId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    if (newStatus === "concluida") {
      const t = tasks.find((t) => t.id === taskId);
      if (t) {
        notifyTelegramTaskCompleted(t.name, t.project_id);
        await createNextRecurringTask(t);
      }
    }
    const task = tasks.find((t) => t.id === taskId);
    const statusLabelsMap: Record<string, string> = { pendente: "Pendente", em_progresso: "Em progresso", concluida: "Concluída", arquivada: "Arquivada" };
    logActivity({
      action: "status_change",
      entity_type: "tarefa",
      entity_name: task?.name || "",
      details: `alterou o status da tarefa "${task?.name}" para ${statusLabelsMap[newStatus] || newStatus}`,
      entity_id: taskId,
      project_id: task?.project_id,
    });
    refetch();
  };

  const handleAdvanceConfirm = async (assignedTo: string) => {
    const t = advancingTask;
    const next = (t as any)?._nextStep as CreativeStep | undefined;
    const due = (t as any)?._dueDate as string | undefined;
    if (!t || !next || !due) { setAdvancingTask(null); return; }

    setAdvanceLoading(true);
    await insertNextTask(t, next, due, assignedTo);
    setAdvanceLoading(false);
    setAdvancingTask(null);
  };

  // Confirm the expert delivery date → mark "Enviar copy para expert" concluded and
  // create the next task ("Esperando entrega do expert") due on that date.
  const handleDatePromptConfirm = async () => {
    const t = datePromptTask;
    const next = (t as any)?._nextStep as CreativeStep | undefined;
    if (!t || !next || !promptDate || !t.ad_id) return; // Confirmar is disabled without a date

    const due = format(promptDate, "yyyy-MM-dd");

    // Only now mark the concluding task complete.
    await supabase.from("tasks").update({ status: "concluida" as const }).eq("id", t.id);
    notifyTelegramTaskCompleted(t.name, t.project_id);

    setDatePromptTask(null);

    const preAssigned = await getPreAssigned(t.ad_id, next.key);
    if (preAssigned) {
      await insertNextTask(t, next, due, preAssigned);
    } else {
      setAdvancingTask({ ...t, _nextStep: next, _dueDate: due } as any);
      refetch();
    }
  };

  const handleDelete = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);

    // If it's a creative pipeline task, also delete the next step's pending task
    if (task?.ad_id) {
      const next = nextStepByLabel(task.name);
      if (next) {
        await supabase
          .from("tasks")
          .delete()
          .eq("ad_id", task.ad_id)
          .eq("name", next.label)
          .eq("status", "pendente");
      }
    }

    // If it's a flow task, also delete the next step task
    if (task?.flow_instance_id != null && task?.flow_step_index != null) {
      await supabase
        .from("tasks")
        .delete()
        .eq("flow_instance_id", task.flow_instance_id)
        .eq("flow_step_index", task.flow_step_index + 1)
        .eq("status", "pendente");
    }

    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Erro ao excluir tarefa");
      return;
    }
    logActivity({
      action: "delete",
      entity_type: "tarefa",
      entity_name: task?.name || "",
      details: `excluiu a tarefa "${task?.name}"`,
      entity_id: taskId,
      project_id: task?.project_id,
    });
    toast.success("Tarefa excluída");
    refetch();
  };

  const createProjectId = projectFilter !== "all" ? projectFilter : currentProject?.id;

  return (
    <div className="animate-fade-in space-y-4 pb-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Tarefas</h1>
          <p className="text-2xs text-muted-foreground mt-0.5">Organize e acompanhe suas tarefas diárias</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[180px] text-xs bg-secondary/30 border-border/50">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Todos os projetos" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-2xs">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-2xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 text-xs">
                <LayoutGrid className="h-4 w-4" />
                Visualização
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-2xs">Exibir tarefas</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={!onlyMine} onCheckedChange={() => setOnlyMine(false)} className="text-2xs">
                Todas as tarefas
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={onlyMine} onCheckedChange={() => setOnlyMine(true)} className="text-2xs">
                Minhas tarefas
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowFlows(true)} className="text-2xs">
                <Workflow className="h-3.5 w-3.5 mr-2" />
                Iniciar Flow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-9 gap-2 text-xs" onClick={() => setShowCreate(true)} disabled={!createProjectId}>
            <Plus className="h-4 w-4" />
            Criar nova tarefa
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-white/[0.04] p-1.5 flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = view === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
              {tab.key === "proxima_tarefa" && proximaTarefaCount > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="rounded-xl bg-white/[0.04] p-4">
        {/* Calendar View */}
        {view === "calendario" ? (
          <div className="flex flex-col h-[560px]">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center gap-3 mb-3">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium text-foreground capitalize min-w-[140px] text-center">
                {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border/50 mb-0">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid with tasks inside cells */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-7 auto-rows-fr min-h-full">
                {(() => {
                  const monthStart = startOfMonth(calendarMonth);
                  const monthEnd = endOfMonth(calendarMonth);
                  const calStart = startOfWeek(monthStart);
                  const calEnd = endOfWeek(monthEnd);
                  const days = eachDayOfInterval({ start: calStart, end: calEnd });

                  // Group tasks by date
                  const taskMap: Record<string, typeof calendarTasks> = {};
                  calendarTasks.forEach((t) => {
                    if (t.due_date) {
                      if (!taskMap[t.due_date]) taskMap[t.due_date] = [];
                      taskMap[t.due_date].push(t);
                    }
                  });

                  return days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayTasks = taskMap[dateKey] || [];
                    const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                    const isTodayDate = isToday(day);

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          "border-r border-b border-border/30 p-1 min-h-[90px] flex flex-col",
                          !isCurrentMonth && "opacity-40 bg-muted/10",
                          isTodayDate && "bg-accent/20"
                        )}
                      >
                        <span className={cn(
                          "text-[10px] font-medium mb-0.5 px-0.5",
                          isTodayDate ? "text-primary" : "text-muted-foreground"
                        )}>
                          {day.getDate()}
                        </span>
                        <div className="flex-1 space-y-0.5 overflow-y-auto max-h-[120px]">
                          {dayTasks.map((task) => (
                            <div
                              key={task.id}
                              onClick={() => setViewingTask(task)}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] leading-tight cursor-pointer truncate transition-colors",
                                task.status === "pendente" && "bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25",
                                task.status === "em_progresso" && "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25",
                                task.status === "concluida" && "bg-green-500/15 text-green-300 hover:bg-green-500/25",
                              )}
                              title={`${task.name}${task.project_name ? ` — ${task.project_name}` : ""}`}
                            >
                              {task.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          </div>
        ) : (
          /* Standard Task List */
          <div className="min-h-[420px] space-y-2">
            {loading ? (
              <p className="text-2xs text-muted-foreground py-16 text-center">Carregando...</p>
            ) : filteredTasks.length === 0 && (view !== "proxima_tarefa" || upcomingTasks.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-full border border-dashed border-border/60 flex items-center justify-center mb-5">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">
                  {view === "hoje" ? "Nenhuma tarefa para hoje" : "Nenhuma tarefa encontrada"}
                </p>
                <p className="text-2xs text-muted-foreground max-w-xs mb-5">
                  {view === "hoje"
                    ? "Você está em dia! Que tal criar uma nova tarefa para manter o foco?"
                    : "As tarefas aparecerão aqui quando forem criadas."}
                </p>
                {createProjectId && (
                  <Button size="sm" className="h-9 gap-2 text-xs" onClick={() => setShowCreate(true)}>
                    <Plus className="h-4 w-4" />
                    Criar nova tarefa
                  </Button>
                )}
              </div>
            ) : (
              <>
                {filteredTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="border-0 bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition-colors overflow-hidden"
                    onClick={() => setViewingTask(task)}
                  >
                    <div className="flex items-stretch">
                      {/* Avatar column */}
                      {task.assigned_to && (
                        <div className="w-12 shrink-0 flex items-center justify-center bg-secondary/30 border-r border-border/30">
                          <Avatar className="h-8 w-8">
                            {task.assigned_avatar ? (
                              <AvatarImage src={task.assigned_avatar} alt={task.assigned_name} />
                            ) : null}
                            <AvatarFallback className="text-[10px] bg-orange-500/20 text-orange-400">
                              {task.assigned_name?.charAt(0) || <User className="h-3.5 w-3.5" />}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 p-3">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-2xs font-medium text-foreground truncate">{task.name}</span>
                          {task.priority === "alta" && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 border", isLight ? INFO_BADGE_LIGHT : "bg-red-500/20 text-red-400 border-red-500/30")}
                            >
                              Alta
                            </Badge>
                          )}
                          {task.ad_id && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 border", isLight ? INFO_BADGE_LIGHT : "bg-purple-500/20 text-purple-400 border-purple-500/30")}
                            >
                              <Palette className="h-2.5 w-2.5 mr-0.5" />
                              Criativo
                            </Badge>
                          )}
                          {task.drive_link && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/30 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(task.drive_link, "_blank");
                              }}
                            >
                              <ExternalLink className="h-2.5 w-2.5 mr-0.5" />
                              Drive
                            </Badge>
                          )}
                          {task.project_name && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 border", isLight ? INFO_BADGE_LIGHT : "bg-accent/50 text-accent-foreground border-border/50")}
                            >
                              <FolderOpen className="h-2.5 w-2.5 mr-0.5" />
                              {task.project_name}
                            </Badge>
                          )}
                          {task.remessa_name && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 border", isLight ? INFO_BADGE_LIGHT : "bg-sky-500/20 text-sky-400 border-sky-500/30")}
                            >
                              {task.remessa_name}
                            </Badge>
                          )}
                          {task.assigned_name && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 border", isLight ? INFO_BADGE_LIGHT : "bg-orange-500/20 text-orange-400 border-orange-500/30")}
                            >
                              {task.assigned_name}
                            </Badge>
                          )}
                          {task.recurrence && task.recurrence !== "none" && (
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0 border", isLight ? INFO_BADGE_LIGHT : "bg-teal-500/20 text-teal-400 border-teal-500/30")}
                            >
                              <Repeat className="h-2.5 w-2.5 mr-0.5" />
                              {task.recurrence === "weekly" ? "Semanal" : "Mensal"}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0 border", isLight ? statusColorsLight[task.status] : statusColors[task.status])}
                          >
                            {statusLabels[task.status]}
                          </Badge>
                        </div>

                        {task.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-2.5 w-2.5" />
                              {format(parseISO(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 p-3 pl-0" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={task.status}
                          onValueChange={(v) => handleStatusChange(task.id, v)}
                        >
                          <SelectTrigger className="h-6 w-[100px] text-[10px] bg-secondary/30 border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente" className="text-2xs">Pendente</SelectItem>
                            <SelectItem value="em_progresso" className="text-2xs">Em progresso</SelectItem>
                            <SelectItem value="concluida" className="text-2xs">Concluída</SelectItem>
                            <SelectItem value="arquivada" className="text-2xs">Arquivada</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingTask(task)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>

                        {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass border-border/50">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-sm">Excluir tarefa?</AlertDialogTitle>
                              <AlertDialogDescription className="text-2xs">
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="text-2xs h-7">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(task.id)}
                                className="text-2xs h-7 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Upcoming virtual tasks (only in Próxima tarefa view) */}
                {view === "proxima_tarefa" && upcomingTasks.length > 0 && (
                  <>
                    {filteredTasks.length > 0 && (
                      <div className="h-px bg-border/50 my-3" />
                    )}
                    <p className="text-2xs font-medium text-muted-foreground px-1 mb-1">A caminho</p>
                    {upcomingTasks.map((ut) => (
                      <Card
                        key={ut.id}
                        className="glass border-border/50 border-dashed p-3 opacity-70"
                      >
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-2xs font-medium text-foreground">{ut.name}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 border",
                              ut.type === "flow"
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                            )}
                          >
                            {ut.type === "flow" ? (
                              <><Workflow className="h-2.5 w-2.5 mr-0.5" />Flow</>
                            ) : (
                              <><Palette className="h-2.5 w-2.5 mr-0.5" />Criativo</>
                            )}
                          </Badge>
                          {ut.project_name && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-accent/50 text-accent-foreground border-border/50">
                              <FolderOpen className="h-2.5 w-2.5 mr-0.5" />
                              {ut.project_name}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border bg-muted text-muted-foreground border-border/50">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            Aguardando
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{ut.description}</p>
                      </Card>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {createProjectId && (
        <CreateTaskDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          projectId={createProjectId}
          projects={projects}
          onCreated={refetch}
          isDirector={isFullAccess}
        />
      )}

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(v) => !v && setEditingTask(null)}
          task={editingTask}
          projects={projects}
          onUpdated={refetch}
        />
      )}

      {/* View task detail dialog */}
      {viewingTask && (
        <ViewTaskDialog
          open={!!viewingTask}
          onOpenChange={(v) => !v && setViewingTask(null)}
          task={viewingTask}
        />
      )}

      {/* Advance creative task dialog */}
      <AssignTaskDialog
        open={!!advancingTask}
        onClose={() => setAdvancingTask(null)}
        onConfirm={handleAdvanceConfirm}
        members={members}
        columnLabel={advancingTask ? ((advancingTask as any)._nextStep?.label ?? "") : ""}
        loading={advanceLoading}
      />

      {/* Mandatory delivery date prompt (concluding "Enviar copy para expert").
          Cannot be dismissed without a date — closing attempts blink a warning. */}
      <Dialog open={!!datePromptTask} onOpenChange={(v) => { if (!v && !promptDate) setDateWarn(true); }}>
        <DialogContent className="sm:max-w-fit" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-sm">Quando o expert vai entregar?</DialogTitle>
          </DialogHeader>
          <p className="text-2xs text-muted-foreground">
            A tarefa "{(datePromptTask as any)?._nextStep?.label ?? "próxima"}" será criada com este prazo.
          </p>
          <div className="flex justify-center py-1">
            <Calendar
              mode="single"
              selected={promptDate}
              onSelect={(d) => { setPromptDate(d); if (d) setDateWarn(false); }}
              locale={ptBR}
            />
          </div>
          {dateWarn && !promptDate && (
            <p className="text-center text-xs font-semibold text-red-500 animate-pulse">
              Colocar data de entrega
            </p>
          )}
          <DialogFooter>
            <Button size="sm" disabled={!promptDate} onClick={handleDatePromptConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flow dialog */}
      <FlowDialog
        open={showFlows}
        onOpenChange={setShowFlows}
        projects={projects}
        onFlowStarted={refetch}
      />
    </div>
  );
};

export default Dashboard;
