import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Task } from "@/hooks/useTasks";
import { ViewTaskDialog } from "@/components/tasks/ViewTaskDialog";

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dueDay(t: Task): string | null {
  return t.due_date ? t.due_date.slice(0, 10) : null;
}

function fmtDate(day: string): string {
  try {
    return format(new Date(day + "T12:00:00"), "d 'de' MMM", { locale: ptBR });
  } catch {
    return day;
  }
}

interface Props {
  task: Task;
  onToggle: (t: Task) => void;
}

export function TaskRow({ task, onToggle }: Props) {
  const [view, setView] = useState(false);
  const done = task.status === "concluida";
  const day = dueDay(task);
  const overdue = !!day && day < localToday() && !done;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/40">
      <button
        onClick={() => onToggle(task)}
        className={cn(
          "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          done ? "bg-primary border-primary" : "border-muted-foreground/50 hover:border-primary",
        )}
        aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
      >
        {done && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
      </button>
      <div
        onClick={() => setView(true)}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <p className={cn("text-sm leading-snug", done ? "line-through text-muted-foreground" : "text-foreground")}>
          {task.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          {day && (
            <span className={overdue ? "text-red-400" : "text-muted-foreground"}>{fmtDate(day)}</span>
          )}
          {day && task.project_name && <span className="text-muted-foreground/50">·</span>}
          {task.project_name && <span className="text-muted-foreground truncate">{task.project_name}</span>}
        </div>
      </div>

      <ViewTaskDialog open={view} onOpenChange={setView} task={task} />
    </div>
  );
}
