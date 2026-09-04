import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useTasks, type Task } from "@/hooks/useTasks";
import { TaskRow, dueDay, localToday } from "@/components/mobile/TaskRow";
import { AddTaskFab } from "@/components/mobile/AddTaskFab";

const MobileToday = () => {
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
  const overdue = mine
    .filter((t) => { const d = dueDay(t); return d && d < today; })
    .sort((a, b) => (dueDay(a)! < dueDay(b)! ? -1 : 1));
  const todayTasks = mine.filter((t) => dueDay(t) === today);

  const empty = !loading && overdue.length === 0 && todayTasks.length === 0;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-4">Hoje</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mb-3 text-primary/60" />
          <p className="text-sm text-foreground">Tudo em dia!</p>
          <p className="text-xs">Nenhuma tarefa para hoje.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-400 mb-1">Atrasadas</h2>
              {overdue.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} />)}
            </section>
          )}
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1">Hoje</h2>
            {todayTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3">Nenhuma tarefa para hoje.</p>
            ) : (
              todayTasks.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} />)
            )}
          </section>
        </div>
      )}

      <AddTaskFab onCreated={refetch} />
    </div>
  );
};

export default MobileToday;
