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
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, Plus, Link as LinkIcon, FolderOpen, ArrowLeft, ChevronRight, Shield, Repeat } from "lucide-react";
import { format, addDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";
import { notifyTelegramAssignment } from "@/lib/notifyTelegram";

interface Member {
  user_id: string;
  full_name?: string;
}

interface ProjectOption {
  id: string;
  name: string;
}

interface FolderOption {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projects?: ProjectOption[];
  onCreated: () => void;
  isDirector?: boolean;
}

export function CreateTaskDialog({ open, onOpenChange, projectId, projects, onCreated, isDirector }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);
  const [offerName, setOfferName] = useState("");
  const [link, setLink] = useState("");
  const [offerOptions, setOfferOptions] = useState<string[]>([]);
  const [addingOffer, setAddingOffer] = useState(false);
  const [newOfferName, setNewOfferName] = useState("");
  const [directorsOnly, setDirectorsOnly] = useState(false);
  const [recurrence, setRecurrence] = useState<"none" | "weekly" | "monthly">("none");

  // Folder state
  const [directoryEnabled, setDirectoryEnabled] = useState(false);
  const [folderId, setFolderId] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [folderParentStack, setFolderParentStack] = useState<{ id: string; name: string }[]>([]);

  const currentFolderParentId = folderParentStack.length > 0 ? folderParentStack[folderParentStack.length - 1].id : null;
  const visibleFolders = allFolders.filter((f) => f.parent_id === currentFolderParentId);

  // Sync default project when dialog opens or projectId changes
  useEffect(() => {
    if (open) {
      setSelectedProjectId(projectId);
      setOfferName("");
      setLink("");
      setAddingOffer(false);
      setNewOfferName("");
      setDirectoryEnabled(false);
      setFolderId("");
      setFileName("");
      setFolderParentStack([]);
      setDirectorsOnly(false);
      setRecurrence("none");
    }
  }, [open, projectId]);

  // Fetch ALL folders for the project (we filter client-side by parent)
  useEffect(() => {
    if (!open || !selectedProjectId) return;
    (async () => {
      const { data } = await supabase
        .from("folders")
        .select("id, name, color, parent_id")
        .eq("project_id", selectedProjectId)
        .order("name");
      setAllFolders((data ?? []) as FolderOption[]);
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

  useEffect(() => {
    if (!open || !selectedProjectId) return;
    setAssignedTo("");
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
    })();
  }, [open, selectedProjectId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome da tarefa é obrigatório");
      return;
    }
    if (!selectedProjectId) {
      toast.error("Selecione um projeto");
      return;
    }
    if (recurrence !== "none" && !dueDate) {
      toast.error("Para repetir a tarefa, selecione uma data de vencimento");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("tasks").insert({
      project_id: selectedProjectId,
      name: name.trim(),
      description: description.trim(),
      assigned_to: assignedTo || null,
      created_by: user?.id || null,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      offer_name: offerName.trim(),
      link: link.trim(),
      folder_id: directoryEnabled && folderId ? folderId : null,
      file_name: directoryEnabled ? fileName.trim() : "",
      directors_only: directorsOnly,
      recurrence,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar tarefa");
      return;
    }
    toast.success("Tarefa criada!");
    if (assignedTo) {
      notifyTelegramAssignment(name.trim(), assignedTo, selectedProjectId);
    }
    if (!directorsOnly) {
      logActivity({
        action: "create",
        entity_type: "tarefa",
        entity_name: name.trim(),
        details: `criou a tarefa "${name.trim()}"`,
        project_id: selectedProjectId,
      });
    }
    setName("");
    setDescription("");
    setAssignedTo("");
    setDueDate(undefined);
    setOfferName("");
    setLink("");
    setDirectoryEnabled(false);
    setFolderId("");
    setRecurrence("none");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Nova Tarefa</DialogTitle>
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
              placeholder="Ex: Criar novo criativo"
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
                        // Already exists, just select it
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
                  className="h-8 w-8 shrink-0 border-border/50"
                  onClick={() => setAddingOffer(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Link field */}
          <div className="space-y-1.5">
            <Label className="text-2xs">Link (opcional)</Label>
            <div className="relative">
              <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                className="h-8 text-2xs bg-secondary/30 border-border/50 pl-8"
              />
            </div>
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

          {/* Directory toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-2xs cursor-pointer" htmlFor="dir-toggle">Diretório</Label>
              </div>
              <Switch
                id="dir-toggle"
                checked={directoryEnabled}
                onCheckedChange={(checked) => {
                  setDirectoryEnabled(checked);
                  if (!checked) { setFolderId(""); setFileName(""); setFolderParentStack([]); }
                }}
                className="scale-75"
              />
            </div>
            {directoryEnabled && (
              <div className="space-y-3 pl-5">
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
                    {/* Breadcrumb / back */}
                    {folderParentStack.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            // If the deselected folder was the current parent, clear selection
                            const goingBackTo = folderParentStack.length > 1
                              ? folderParentStack[folderParentStack.length - 2].id
                              : null;
                            setFolderParentStack((prev) => prev.slice(0, -1));
                            // Keep folderId if it still makes sense, otherwise clear
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

          <div className="space-y-1.5">
            <Label className="text-2xs">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a tarefa..."
              className="text-2xs bg-secondary/30 border-border/50 min-h-[80px]"
            />
          </div>

          {/* Directors only toggle - only for owner/master */}
          {isDirector && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-2xs font-medium text-amber-300">Configuração da Diretoria</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ative para que esta tarefa seja visível apenas para Dono e Master. Ela não aparecerá no histórico de atividades.
              </p>
              <div className="flex items-center justify-between">
                <Label className="text-2xs cursor-pointer" htmlFor="directors-toggle">Apenas Diretoria</Label>
                <Switch
                  id="directors-toggle"
                  checked={directorsOnly}
                  onCheckedChange={setDirectorsOnly}
                  className="scale-75"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-2xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="text-2xs"
            >
              {saving ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
