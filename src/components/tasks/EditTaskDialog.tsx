import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Forward, ArrowRight, FolderOpen, ArrowLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format, parseISO, addDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Task } from "@/hooks/useTasks";
import { notifyTelegramAssignment, notifyTelegramTaskCompleted } from "@/lib/notifyTelegram";
import { nextStepByLabel } from "@/lib/creativeSteps";

interface FolderOption {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
}

interface Member {
  user_id: string;
  full_name?: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task;
  projects?: ProjectOption[];
  onUpdated: () => void;
}

export function EditTaskDialog({ open, onOpenChange, task, projects, onUpdated }: Props) {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description);
  const [assignedTo, setAssignedTo] = useState<string>(task.assigned_to || "");
  const [selectedProjectId, setSelectedProjectId] = useState(task.project_id);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? parseISO(task.due_date) : undefined
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [forwardTo, setForwardTo] = useState<string>("");
  const [forwarding, setForwarding] = useState(false);
  const [folderEnabled, setFolderEnabled] = useState(!!task.folder_id);
  const [folderId, setFolderId] = useState<string>(task.folder_id || "");
  const [fileName, setFileName] = useState(task.file_name || "");
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [folderParentStack, setFolderParentStack] = useState<{ id: string; name: string }[]>([]);
  const [offerName, setOfferName] = useState(task.offer_name || "");
  const [priority, setPriority] = useState<string>(task.priority || "normal");
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "monthly">(task.recurrence || "none");
  const [link, setLink] = useState(task.link || "");
  const [offerOptions, setOfferOptions] = useState<string[]>([]);
  const [addingOffer, setAddingOffer] = useState(false);
  const [newOfferName, setNewOfferName] = useState("");

  const currentFolderParentId = folderParentStack.length > 0 ? folderParentStack[folderParentStack.length - 1].id : null;
  const visibleFolders = allFolders.filter((f) => f.parent_id === currentFolderParentId);

  const isCreativeTask = !!task.ad_id;
  const nextPhase = isCreativeTask ? nextStepByLabel(task.name) : null;

  useEffect(() => {
    setName(task.name);
    setDescription(task.description);
    setAssignedTo(task.assigned_to || "");
    setSelectedProjectId(task.project_id);
    setDueDate(task.due_date ? parseISO(task.due_date) : undefined);
    setFolderEnabled(!!task.folder_id);
    setFolderId(task.folder_id || "");
    setFileName(task.file_name || "");
    setOfferName(task.offer_name || "");
    setPriority(task.priority || "normal");
    setRecurrence(task.recurrence || "none");
    setLink(task.link || "");
    setAddingOffer(false);
    setNewOfferName("");
  }, [task]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("user_projects")
        .select("user_id")
        .eq("project_id", selectedProjectId);
      if (!data) return;
      const ids = data.map((d) => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      setMembers(
        (profiles ?? []).map((p) => ({ user_id: p.id, full_name: p.full_name }))
      );

      const { data: folderData } = await supabase
        .from("folders")
        .select("id, name, color, parent_id")
        .eq("project_id", selectedProjectId)
        .order("name");
      setAllFolders((folderData ?? []) as FolderOption[]);
    })();
  }, [open, selectedProjectId]);

  // Fetch offers for the project from offers table
  useEffect(() => {
    if (!open || !selectedProjectId) return;
    (async () => {
      const { data } = await supabase
        .from("offers")
        .select("name")
        .eq("project_id", selectedProjectId)
        .order("name");
      setOfferOptions((data ?? []).map((d: any) => d.name));
    })();
  }, [open, selectedProjectId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome da tarefa é obrigatório");
      return;
    }
    if (recurrence !== "none" && !dueDate) {
      toast.error("Para repetir a tarefa, selecione uma data de vencimento");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        project_id: selectedProjectId,
        name: name.trim(),
        description: description.trim(),
        assigned_to: assignedTo || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        folder_id: folderEnabled && folderId ? folderId : null,
        file_name: folderEnabled ? fileName.trim() : "",
        offer_name: offerName.trim(),
        priority,
        recurrence,
        link: link.trim(),
      } as any)
      .eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar tarefa");
      return;
    }
    toast.success("Tarefa atualizada!");
    // Notify via Telegram if assigned_to changed
    if (assignedTo && assignedTo !== task.assigned_to) {
      notifyTelegramAssignment(name.trim(), assignedTo, selectedProjectId);
    }
    onOpenChange(false);
    onUpdated();
  };

  const handleForward = async () => {
    if (!forwardTo) return;
    setForwarding(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (isCreativeTask && nextPhase && task.ad_id) {
      await supabase
        .from("tasks")
        .update({ status: "concluida" as const })
        .eq("id", task.id);
      notifyTelegramTaskCompleted(task.name, task.project_id);

      const { error } = await supabase.from("tasks").insert({
        project_id: task.project_id,
        ad_id: task.ad_id,
        name: nextPhase.label,
        description: `Tarefa criada ao avançar para "${nextPhase.label}".`,
        assigned_to: forwardTo,
        created_by: user?.id || null,
        status: "pendente" as const,
        priority: "alta",
        due_date: format(new Date(), "yyyy-MM-dd"),
      } as any);

      setForwarding(false);
      if (error) {
        toast.error("Erro ao avançar tarefa");
        return;
      }
      toast.success(`Avançado para "${nextPhase.label}"!`);
      notifyTelegramAssignment(nextPhase.label, forwardTo, task.project_id);
    } else {
      const { error } = await supabase.from("tasks").insert({
        project_id: task.project_id,
        name: task.name,
        description: task.description,
        assigned_to: forwardTo,
        created_by: user?.id || null,
        due_date: task.due_date,
        ad_id: task.ad_id || null,
        status: "pendente" as const,
      });

      setForwarding(false);
      if (error) {
        toast.error("Erro ao repassar tarefa");
        return;
      }
      toast.success("Tarefa repassada!");
      notifyTelegramAssignment(task.name, forwardTo, task.project_id);
    }

    setShowForward(false);
    setForwardTo("");
    onOpenChange(false);
    onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Editar Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Project selector */}
          {projects && projects.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-2xs">Projeto</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50">
                  <SelectValue placeholder="Selecionar projeto" />
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
          )}

          <div className="space-y-1.5">
            <Label className="text-2xs">Nome da Tarefa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-2xs bg-secondary/30 border-border/50"
            />
          </div>

          {/* Offer name selector */}
          <div className="space-y-1.5">
            <Label className="text-2xs">Oferta</Label>
            {addingOffer ? (
              <div className="flex gap-2">
                <Input
                  value={newOfferName}
                  onChange={(e) => setNewOfferName(e.target.value)}
                  placeholder="Nome da nova oferta"
                  className="h-8 text-2xs bg-secondary/30 border-border/50 flex-1"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && newOfferName.trim()) {
                      const trimmed = newOfferName.trim();
                      const { data: { user } } = await supabase.auth.getUser();
                      const { error } = await supabase.from("offers").insert({
                        project_id: selectedProjectId,
                        name: trimmed,
                        created_by: user?.id || "",
                      } as any);
                      if (!error) {
                        setOfferOptions((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
                        setOfferName(trimmed);
                      } else if (error.code === "23505") {
                        setOfferName(trimmed);
                      } else {
                        toast.error("Erro ao salvar oferta");
                      }
                      setNewOfferName("");
                      setAddingOffer(false);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-2xs px-2"
                  onClick={async () => {
                    if (newOfferName.trim()) {
                      const trimmed = newOfferName.trim();
                      const { data: { user } } = await supabase.auth.getUser();
                      const { error } = await supabase.from("offers").insert({
                        project_id: selectedProjectId,
                        name: trimmed,
                        created_by: user?.id || "",
                      } as any);
                      if (!error) {
                        setOfferOptions((prev) => prev.includes(trimmed) ? prev : [...prev, trimmed]);
                        setOfferName(trimmed);
                      } else if (error.code === "23505") {
                        setOfferName(trimmed);
                      } else {
                        toast.error("Erro ao salvar oferta");
                      }
                    }
                    setNewOfferName("");
                    setAddingOffer(false);
                  }}
                >
                  OK
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-2xs px-2"
                  onClick={() => { setAddingOffer(false); setNewOfferName(""); }}
                >
                  ✕
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select key={offerName} value={offerName} onValueChange={setOfferName}>
                  <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50 flex-1">
                    <SelectValue placeholder="Selecionar oferta" />
                  </SelectTrigger>
                  <SelectContent>
                    {offerOptions.map((o) => (
                      <SelectItem key={o} value={o} className="text-2xs">
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setAddingOffer(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Link */}
          <div className="space-y-1.5">
            <Label className="text-2xs">Link (opcional)</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="h-8 text-2xs bg-secondary/30 border-border/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Responsável</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id} className="text-2xs">
                    {m.full_name || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Data de vencimento (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8 w-full justify-start text-2xs bg-secondary/30 border-border/50",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dueDate} onSelect={setDueDate} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal" className="text-2xs">Normal</SelectItem>
                <SelectItem value="alta" className="text-2xs">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recurrence */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Repeat className="h-3 w-3 text-muted-foreground" />
              <Label className="text-2xs">Repetição</Label>
            </div>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as any)}>
              <SelectTrigger className="h-8 text-2xs bg-secondary/30 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-2xs">Não repete</SelectItem>
                <SelectItem value="weekly" className="text-2xs">Semanalmente (mesmo dia da semana)</SelectItem>
                <SelectItem value="monthly" className="text-2xs">Mensalmente (mesmo dia do mês)</SelectItem>
              </SelectContent>
            </Select>
            {recurrence !== "none" && (
              <p className="text-[10px] text-muted-foreground leading-snug">
                {dueDate ? (
                  <>
                    Ao concluir, será criada uma nova tarefa para{" "}
                    <span className="font-medium text-foreground">
                      {format(
                        recurrence === "weekly" ? addDays(dueDate, 7) : addMonths(dueDate, 1),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </span>
                    .
                  </>
                ) : (
                  "Selecione uma data de vencimento para definir a repetição."
                )}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-2xs">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-2xs bg-secondary/30 border-border/50 min-h-[80px]"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border/50 p-3 bg-secondary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-2xs font-medium cursor-pointer" htmlFor="edit-dir-toggle">Diretório</Label>
              </div>
              <Switch
                id="edit-dir-toggle"
                checked={folderEnabled}
                onCheckedChange={(checked) => {
                  setFolderEnabled(checked);
                  if (!checked) { setFolderId(""); setFileName(""); setFolderParentStack([]); }
                }}
                className="scale-75"
              />
            </div>
            {folderEnabled && (
              <div className="space-y-3 pl-5 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-2xs">Nome do arquivo</Label>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Nome que aparecerá na pasta"
                    className="h-8 text-2xs bg-secondary/30 border-border/50"
                  />
                </div>
                {allFolders.length === 0 ? (
                  <p className="text-2xs text-muted-foreground">Nenhuma pasta criada. Crie pastas na aba Arquivos.</p>
                ) : (
                  <div className="space-y-2">
                    {folderParentStack.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const goingBackTo = folderParentStack.length > 1
                              ? folderParentStack[folderParentStack.length - 2].id
                              : null;
                            setFolderParentStack((prev) => prev.slice(0, -1));
                            if (folderId === currentFolderParentId) {
                              setFolderId(goingBackTo || "");
                            }
                          }}
                          className="h-5 w-5 rounded bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {folderParentStack.map((s) => s.name).join(" / ")}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                      {visibleFolders.map((f) => {
                        const hasChildren = allFolders.some((c) => c.parent_id === f.id);
                        return (
                          <div
                            key={f.id}
                            className={cn(
                              "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200 text-center cursor-pointer",
                              folderId === f.id
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border/30 bg-secondary/20 hover:border-border/50 hover:bg-secondary/40"
                            )}
                            onClick={() => setFolderId(folderId === f.id ? "" : f.id)}
                          >
                            <div
                              className="h-8 w-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${f.color}20` }}
                            >
                              <FolderOpen className="h-4 w-4" style={{ color: f.color }} />
                            </div>
                            <span className="text-[10px] leading-tight font-medium truncate w-full">{f.name}</span>
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderParentStack((prev) => [...prev, { id: f.id, name: f.name }]);
                                }}
                                className="absolute top-1 right-1 h-5 w-5 rounded-md bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {visibleFolders.length === 0 && folderParentStack.length > 0 && (
                      <p className="text-2xs text-muted-foreground text-center py-2">Nenhuma subpasta</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>



          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-2xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="text-2xs">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
