import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useFolders, Folder } from "@/hooks/useFolders";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FolderOpen, Plus, ArrowLeft, MoreVertical, Pencil, Trash2, Link as LinkIcon, User, Tag, Calendar, Clock, MessageSquare, ExternalLink, RotateCcw, Archive } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const FOLDER_COLORS = [
  "#f97316", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4",
];

interface FolderTask {
  id: string;
  name: string;
  file_name: string;
  offer_name: string;
  link: string;
  assigned_name: string;
  status: string;
  created_at: string;
  due_date: string | null;
}

interface TaskComment {
  id: string;
  content: string;
  created_at: string;
  user_name: string;
}

const Arquivos = () => {
  const { currentProject } = useProjectContext();
  const { role } = useCurrentUserRole();
  const isOwner = role === "owner";
  const [searchParams, setSearchParams] = useSearchParams();
  const [parentStack, setParentStack] = useState<{ id: string; name: string }[]>([]);
  const currentParentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null;
  const { folders, isLoading, createFolder, deleteFolder, renameFolder, trashedFolders, isLoadingTrash, restoreFolder, permanentDeleteFolder } = useFolders(currentParentId);
  const [showTrash, setShowTrash] = useState(false);

  // Handle deep link from chat (#folder mention)
  useEffect(() => {
    const folderId = searchParams.get("folder");
    if (!folderId || !currentProject) return;
    (async () => {
      const { data } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("id", folderId)
        .single();
      if (data) {
        const stack: { id: string; name: string }[] = [];
        let current = data;
        stack.unshift({ id: current.id, name: current.name });
        while (current.parent_id) {
          const { data: parent } = await supabase
            .from("folders")
            .select("id, name, parent_id")
            .eq("id", current.parent_id)
            .single();
          if (!parent) break;
          stack.unshift({ id: parent.id, name: parent.name });
          current = parent;
        }
        setParentStack(stack);
        setSearchParams({}, { replace: true });
      }
    })();
  }, [searchParams, currentProject]);

  // Handle deep link from chat (#task mention)
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || !currentProject) return;
    (async () => {
      const { data: task } = await supabase
        .from("tasks")
        .select("id, name, file_name, offer_name, link, assigned_to, status, folder_id, created_at, due_date")
        .eq("id", taskId)
        .single();
      if (!task || !task.folder_id) return;

      // Build the parent stack to navigate into the task's folder
      const { data: folder } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("id", task.folder_id)
        .single();
      if (!folder) return;

      const stack: { id: string; name: string }[] = [];
      let current = folder;
      stack.unshift({ id: current.id, name: current.name });
      while (current.parent_id) {
        const { data: parent } = await supabase
          .from("folders")
          .select("id, name, parent_id")
          .eq("id", current.parent_id)
          .single();
        if (!parent) break;
        stack.unshift({ id: parent.id, name: parent.name });
        current = parent;
      }
      setParentStack(stack);
      setSearchParams({}, { replace: true });

      // Resolve assigned_to name
      let assignedName: string | undefined;
      if (task.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", task.assigned_to)
          .single();
        assignedName = profile?.full_name || undefined;
      }

      // Open the task detail dialog
      openTaskDetail({
        id: task.id,
        name: task.name,
        file_name: task.file_name || undefined,
        offer_name: task.offer_name || undefined,
        link: task.link || undefined,
        assigned_to: task.assigned_to || undefined,
        assigned_name: assignedName,
        status: task.status,
        folder_id: task.folder_id,
        created_at: task.created_at,
        due_date: task.due_date || undefined,
      } as FolderTask);
    })();
  }, [searchParams, currentProject]);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);

  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [deletingTask, setDeletingTask] = useState<FolderTask | null>(null);

  // Task detail dialog
  const [selectedTask, setSelectedTask] = useState<FolderTask | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Tasks inside the current folder
  const [folderTasks, setFolderTasks] = useState<FolderTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!currentParentId) {
      setFolderTasks([]);
      return;
    }
    (async () => {
      setLoadingTasks(true);
      const { data } = await supabase
        .from("tasks")
        .select("id, name, file_name, offer_name, link, assigned_to, status, folder_id, created_at, due_date")
        .eq("folder_id", currentParentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        setFolderTasks([]);
        setLoadingTasks(false);
        return;
      }

      // resolve assigned names
      const assignedIds = [...new Set((data as any[]).filter((t) => t.assigned_to).map((t) => t.assigned_to))];
      let profileMap: Record<string, string> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", assignedIds);
        profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
      }

      setFolderTasks(
        (data as any[]).map((t) => ({
          id: t.id,
          name: t.name || "Sem nome",
          file_name: t.file_name || "",
          offer_name: t.offer_name || "",
          link: t.link || "",
          assigned_name: t.assigned_to ? profileMap[t.assigned_to] || "" : "",
          status: t.status,
          created_at: t.created_at,
          due_date: t.due_date || null,
        }))
      );
      setLoadingTasks(false);
    })();
  }, [currentParentId]);

  const openTaskDetail = async (task: FolderTask) => {
    setSelectedTask(task);
    setLoadingComments(true);
    const { data } = await supabase
      .from("task_comments")
      .select("id, content, created_at, user_id")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const nameMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
      setTaskComments(
        data.map((c) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          user_name: nameMap[c.user_id] || "Usuário",
        }))
      );
    } else {
      setTaskComments([]);
    }
    setLoadingComments(false);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createFolder.mutate({ name: newName.trim(), color: newColor, parentId: currentParentId });
    setNewName("");
    setNewColor(FOLDER_COLORS[0]);
    setShowCreate(false);
  };

  const handleRename = () => {
    if (!renaming || !renameValue.trim()) return;
    renameFolder.mutate({ id: renaming.id, name: renameValue.trim() });
    setRenaming(null);
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteFolder.mutate(deleting.id);
    setDeleting(null);
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;
    const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", deletingTask.id);
    if (error) {
      toast.error("Erro ao excluir tarefa");
    } else {
      toast.success("Tarefa movida para a lixeira");
      setFolderTasks((prev) => prev.filter((t) => t.id !== deletingTask.id));
    }
    setDeletingTask(null);
  };

  // Trash: deleted tasks
  const [trashedTasks, setTrashedTasks] = useState<(FolderTask & { deleted_at: string })[]>([]);
  const [loadingTrashedTasks, setLoadingTrashedTasks] = useState(false);

  useEffect(() => {
    if (!showTrash || !currentProject) return;
    (async () => {
      setLoadingTrashedTasks(true);
      const { data } = await supabase
        .from("tasks")
        .select("id, name, file_name, offer_name, link, assigned_to, status, folder_id, created_at, due_date, deleted_at")
        .eq("project_id", currentProject.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (data) {
        setTrashedTasks(data.map((t: any) => ({
          id: t.id,
          name: t.name || "Sem nome",
          file_name: t.file_name || "",
          offer_name: t.offer_name || "",
          link: t.link || "",
          assigned_name: "",
          status: t.status,
          created_at: t.created_at,
          due_date: t.due_date || null,
          deleted_at: t.deleted_at,
        })));
      }
      setLoadingTrashedTasks(false);
    })();
  }, [showTrash, currentProject]);

  const restoreTask = async (taskId: string) => {
    const { error } = await supabase.from("tasks").update({ deleted_at: null }).eq("id", taskId);
    if (error) {
      toast.error("Erro ao restaurar tarefa");
    } else {
      toast.success("Tarefa restaurada!");
      setTrashedTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const permanentDeleteTask = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Erro ao excluir tarefa permanentemente");
    } else {
      toast.success("Tarefa excluída permanentemente!");
      setTrashedTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const openFolder = (folder: Folder) => {
    setParentStack((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const goBack = () => {
    setParentStack((prev) => prev.slice(0, -1));
  };

  const goTo = (index: number) => {
    setParentStack((prev) => prev.slice(0, index + 1));
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "concluida": return "text-emerald-400";
      case "em_progresso": return "text-amber-400";
      case "pendente": return "text-muted-foreground";
      default: return "text-muted-foreground";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "concluida": return "Concluída";
      case "em_progresso": return "Em progresso";
      case "pendente": return "Pendente";
      case "arquivada": return "Arquivada";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {parentStack.length > 0 && (
            <button
              onClick={goBack}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">Arquivos</h1>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-2xs text-muted-foreground mt-0.5">
              <button onClick={() => setParentStack([])} className="hover:text-foreground transition-colors">
                Raiz
              </button>
              {parentStack.map((item, i) => (
                <span key={item.id} className="flex items-center gap-1">
                  <span>/</span>
                  <button onClick={() => goTo(i)} className="hover:text-foreground transition-colors">
                    {item.name}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              onClick={() => setShowTrash(true)}
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-2xs border-border/50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Lixeira
              {(trashedFolders.length > 0 || trashedTasks.length > 0) && (
                <span className="ml-1 h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                  {trashedFolders.length + trashedTasks.length}
                </span>
              )}
            </Button>
          )}
          <Button
            onClick={() => setShowCreate(true)}
            size="sm"
            className="h-8 gap-1.5 text-2xs bg-primary hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova pasta
          </Button>
        </div>
      </div>

      {/* Folders Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : folders.length === 0 && folderTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <div className="h-16 w-16 rounded-2xl bg-secondary/30 flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm">Nenhuma pasta aqui</p>
          <p className="text-2xs mt-1">Crie uma pasta para organizar seus arquivos</p>
        </div>
      ) : (
        <>
          {folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="group relative rounded-xl bg-white/[0.04] p-4 cursor-pointer transition-all duration-200 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
                  onClick={() => openFolder(folder)}
                >
                  {/* Actions menu */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="h-6 w-6 flex items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass border-border/50 min-w-[140px]">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenaming(folder);
                            setRenameValue(folder.name);
                          }}
                          className="text-2xs gap-2 cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(folder);
                          }}
                          className="text-2xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Folder icon */}
                  <div className="flex flex-col items-center gap-3 pt-2 pb-1">
                    <div
                      className="h-14 w-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${folder.color}15` }}
                    >
                      <FolderOpen className="h-7 w-7" style={{ color: folder.color }} />
                    </div>
                    <span className="text-2xs font-medium text-foreground text-center truncate w-full px-1">
                      {folder.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tasks in current folder */}
          {currentParentId && (
            <div className="space-y-3">
              {folderTasks.length > 0 && (
                <>
                  <h2 className="text-xs font-medium text-muted-foreground">Tarefas nesta pasta</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {folderTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => openTaskDetail(task)}
                        className="group relative rounded-xl bg-white/[0.04] aspect-square p-4 flex flex-col justify-between transition-all duration-200 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 cursor-pointer"
                      >
                        {/* Actions menu */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="h-6 w-6 flex items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass border-border/50 min-w-[140px]">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingTask(task);
                                }}
                                className="text-2xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Top: status */}
                        <div className="flex items-start justify-between">
                          <div className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-secondary/40 ${statusColor(task.status)}`}>
                            {statusLabel(task.status)}
                          </div>
                        </div>

                        {/* Middle: task name */}
                        <div className="flex-1 flex items-center justify-center py-2">
                          <p className="text-xs font-semibold text-foreground text-center line-clamp-3 leading-relaxed">
                            {task.file_name || task.name}
                          </p>
                        </div>

                        {/* Bottom: offer + assignee + link */}
                        <div className="space-y-1.5">
                          {task.offer_name && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-2.5 w-2.5 text-primary/70" />
                              <span className="text-[9px] text-primary/80 truncate font-medium">{task.offer_name}</span>
                            </div>
                          )}
                          {task.assigned_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-2.5 w-2.5 text-muted-foreground/70" />
                              <span className="text-[9px] text-muted-foreground truncate">{task.assigned_name}</span>
                            </div>
                          )}
                          {task.link && (
                            <a
                              href={task.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                            >
                              <LinkIcon className="h-2.5 w-2.5 text-emerald-400" />
                              <span className="text-[9px] text-emerald-400 truncate">Link</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="glass border-border/50 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Nome da pasta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 text-2xs bg-secondary/30 border-border/50"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div>
              <p className="text-2xs text-muted-foreground mb-2">Cor</p>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="h-7 w-7 rounded-lg transition-all duration-150 ring-offset-background"
                    style={{
                      backgroundColor: c,
                      boxShadow: newColor === c ? `0 0 0 2px var(--background), 0 0 0 4px ${c}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="text-2xs h-8">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || createFolder.isPending}
                className="text-2xs h-8"
              >
                {createFolder.isPending ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="glass border-border/50 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Renomear Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-9 text-2xs bg-secondary/30 border-border/50"
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRenaming(null)} className="text-2xs h-8">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleRename}
                disabled={!renameValue.trim() || renameFolder.isPending}
                className="text-2xs h-8"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="glass border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Excluir pasta</AlertDialogTitle>
            <AlertDialogDescription className="text-2xs">
              Tem certeza que deseja excluir a pasta "{deleting?.name}"? Todas as subpastas também serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-2xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="text-2xs h-8 bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent className="glass border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Excluir tarefa</AlertDialogTitle>
            <AlertDialogDescription className="text-2xs">
              Tem certeza que deseja excluir a tarefa "{deletingTask?.file_name || deletingTask?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-2xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="text-2xs h-8 bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="glass border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{selectedTask?.file_name || selectedTask?.name}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 pt-2">
              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-2xs">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Criado em:</span>
                  <span className="text-foreground font-medium">
                    {format(new Date(selectedTask.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Responsável:</span>
                  <span className="text-foreground font-medium">
                    {selectedTask.assigned_name || "Não atribuído"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-2xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Prazo:</span>
                  <span className="text-foreground font-medium">
                    {selectedTask.due_date
                      ? format(new Date(selectedTask.due_date), "dd/MM/yyyy")
                      : "Sem prazo"}
                  </span>
                </div>
                {selectedTask.offer_name && (
                  <div className="flex items-center gap-2 text-2xs">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Oferta:</span>
                    <span className="text-foreground font-medium">{selectedTask.offer_name}</span>
                  </div>
                )}
                {selectedTask.link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-2xs gap-1.5 border-border/50 bg-secondary/30 hover:bg-secondary/50 mt-1"
                    onClick={() => window.open(selectedTask.link, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Acessar Arquivo
                  </Button>
                )}
              </div>

              <Separator className="bg-border/30" />

              {/* Comments */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-2xs font-medium text-muted-foreground">
                    Comentários ({taskComments.length})
                  </span>
                </div>

                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : taskComments.length === 0 ? (
                  <p className="text-2xs text-muted-foreground/60 py-3 text-center">
                    Nenhum comentário nesta tarefa
                  </p>
                ) : (
                  <ScrollArea className="max-h-[240px]">
                    <div className="space-y-3 pr-3">
                      {taskComments.map((comment) => (
                        <div key={comment.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-2xs font-semibold text-foreground">{comment.user_name}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {format(new Date(comment.created_at), "dd/MM/yy HH:mm")}
                            </span>
                          </div>
                          <p className="text-2xs text-muted-foreground leading-relaxed">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trash Dialog */}
      <Dialog open={showTrash} onOpenChange={setShowTrash}>
        <DialogContent className="glass border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Lixeira
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pt-2 pr-3">
              {/* Deleted Folders */}
              {trashedFolders.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-2xs font-medium text-muted-foreground">Pastas excluídas</h3>
                  {trashedFolders.map((folder: any) => (
                    <div key={folder.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${folder.color}15` }}>
                          <FolderOpen className="h-4 w-4" style={{ color: folder.color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xs font-medium text-foreground truncate">{folder.name}</p>
                          <p className="text-[9px] text-muted-foreground">
                            Excluída em {format(new Date(folder.deleted_at), "dd/MM/yy HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => restoreFolder.mutate(folder.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => permanentDeleteFolder.mutate(folder.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir permanentemente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deleted Tasks */}
              {trashedTasks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-2xs font-medium text-muted-foreground">Tarefas excluídas</h3>
                  {trashedTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <div className="min-w-0">
                        <p className="text-2xs font-medium text-foreground truncate">{task.file_name || task.name}</p>
                        <p className="text-[9px] text-muted-foreground">
                          Excluída em {format(new Date(task.deleted_at), "dd/MM/yy HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => restoreTask(task.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                          title="Restaurar"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => permanentDeleteTask(task.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir permanentemente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {trashedFolders.length === 0 && trashedTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Archive className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-2xs">A lixeira está vazia</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Arquivos;
