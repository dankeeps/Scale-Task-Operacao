import { useState } from "react";
import { Plus } from "lucide-react";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";

export function AddTaskFab({ onCreated }: { onCreated: () => void }) {
  const { projects, currentProject } = useProjectContext();
  const { isFullAccess } = useCurrentUserRole();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-5 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground glow-neon flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        aria-label="Nova tarefa"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {currentProject && (
        <CreateTaskDialog
          open={open}
          onOpenChange={setOpen}
          projectId={currentProject.id}
          projects={projects}
          onCreated={onCreated}
          isDirector={isFullAccess}
        />
      )}
    </>
  );
}
