import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useTasks, type Task } from "@/hooks/useTasks";
import { TaskRow, dueDay, localToday } from "@/components/mobile/TaskRow";
import { AddTaskFab } from "@/components/mobile/AddTaskFab";

function dayLabel(day: string): string {
  try {
    return format(new Date(day + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR });
  } catch {
    return day;
  }
}

const MobileUpcoming = () => {
  const { projects } = useProjectContext();
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const { tasks, loading, refetch } = useTasks(projectIds);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setMeId(user?.id ?? null));
  }, []);

  const toggle = async (t: Task) => {
    const next = t.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("tasks").update({ status: next }).eq("id", t.id);
    refetch();
  };

  const today = localToday();
  const mine = tasks.filter(
    (t) => t.assigned_to === meId && t.status !== "concluida" && t.status !== "arquivada",
  );

  const dated = mine
    .filter((t) => { const d = dueDay(t); return d && d > today; })
    .sort((a, b) => (dueDay(a)! < dueDay(b)! ? -1 : 1));
  const noDate = mine.filter((t) => !dueDay(t));

  const groups: { day: string; tasks: Task[] }[] = [];
  for (const t of dated) {
    const d = dueDay(t)!;
    const g = groups.find((x) => x.day === d);
    if (g) g.tasks.push(t);
    else groups.push({ day: d, tasks: [t] });
  }

  const empty = !loading && dated.length === 0 && noDate.length === 0;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-4">Em breve</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <CalendarClock className="h-10 w-10 mb-3 text-primary/60" />
          <p className="text-sm text-foreground">Nada por vir</p>
          <p className="text-xs">Sem tarefas futuras atribuídas a você.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="text-sm font-semibold text-foreground mb-1 capitalize">{dayLabel(g.day)}</h2>
              {g.tasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} />)}
            </section>
          ))}
          {noDate.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-1">Sem data</h2>
              {noDate.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} />)}
            </section>
          )}
        </div>
      )}

      <AddTaskFab onCreated={refetch} />
    </div>
  );
};

export default MobileUpcoming;
