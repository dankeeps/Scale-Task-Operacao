import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, FolderOpen, Palette, User, FileText, Clock, Send, MessageSquare, ExternalLink, Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Task } from "@/hooks/useTasks";

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

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  audio_url?: string | null;
}

interface Member {
  user_id: string;
  full_name: string;
}

interface ViewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function ViewTaskDialog({ open, onOpenChange, task }: ViewTaskDialogProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const handleDeleteComment = async (comment: Comment) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", comment.id);
    if (error) { toast.error("Erro ao excluir comentário"); return; }
    if (comment.audio_url) {
      const url = new URL(comment.audio_url);
      const path = url.pathname.split("/task-audio/")[1];
      if (path) await supabase.storage.from("task-audio").remove([decodeURIComponent(path)]);
    }
    toast.success("Comentário excluído");
    fetchComments();
  };

  const fetchComments = useCallback(async () => {
    if (!task.id) return;
    const { data } = await supabase
      .from("task_comments")
      .select("id, user_id, content, created_at, audio_url")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });

    if (!data) return;

    const userIds = [...new Set(data.map((c) => c.user_id))];
    let profileMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
    }

    setComments(data.map((c) => ({ ...c, user_name: profileMap[c.user_id] || "Usuário" })));
  }, [task.id]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from("user_projects")
      .select("user_id")
      .eq("project_id", task.project_id);
    if (!data) return;
    const ids = data.map((d) => d.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    setMembers((profiles ?? []).map((p) => ({ user_id: p.id, full_name: p.full_name })));
  }, [task.project_id]);

  useEffect(() => {
    if (open) {
      fetchComments();
      fetchMembers();
    }
  }, [open, fetchComments, fetchMembers]);

  useEffect(() => {
    if (comments.length > 0) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments.length]);

  const filteredMembers = useMemo(() => {
    if (!mentionFilter) return members;
    const lower = mentionFilter.toLowerCase();
    return members.filter((m) => m.full_name.toLowerCase().includes(lower));
  }, [members, mentionFilter]);

  // Extract mentioned user IDs from text
  const extractMentions = (text: string): string[] => {
    const mentionedIds: string[] = [];
    // Pattern: @Name (match names that exist in members)
    for (const m of members) {
      if (text.includes(`@${m.full_name}`)) {
        mentionedIds.push(m.user_id);
      }
    }
    return [...new Set(mentionedIds)];
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const discardAudio = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const togglePlayAudio = (id: string, url: string) => {
    if (playingAudioId === id) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingAudioId(null);
    audio.play();
    audioPlayerRef.current = audio;
    setPlayingAudioId(id);
  };

  const handleSend = async () => {
    if (!commentText.trim() && !audioBlob) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    let uploadedAudioUrl: string | null = null;

    // Upload audio if exists
    if (audioBlob) {
      const fileName = `${user.id}/${task.id}-${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from("task-audio")
        .upload(fileName, audioBlob, { contentType: "audio/webm" });

      if (uploadErr) {
        toast.error("Erro ao enviar áudio");
        setSending(false);
        return;
      }

      const { data: publicData } = supabase.storage.from("task-audio").getPublicUrl(fileName);
      uploadedAudioUrl = publicData.publicUrl;
    }

    const mentionedIds = extractMentions(commentText);

    const { error } = await supabase.from("task_comments").insert({
      task_id: task.id,
      user_id: user.id,
      content: commentText.trim() || (uploadedAudioUrl ? "🎤 Áudio" : ""),
      mentioned_user_ids: mentionedIds,
      audio_url: uploadedAudioUrl,
    } as any);

    setSending(false);
    if (error) {
      toast.error("Erro ao enviar comentário");
      return;
    }
    setCommentText("");
    discardAudio();
    fetchComments();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCommentText(val);
    setCursorPos(pos);

    // Check if we're in a @mention context
    const textBeforeCursor = val.slice(0, pos);
    const lastAt = textBeforeCursor.lastIndexOf("@");

    if (lastAt !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      // Only show if no space after @ or the text is a partial name
      if (!textAfterAt.includes("\n") && (textAfterAt === "" || !textAfterAt.endsWith(" "))) {
        setMentionFilter(textAfterAt);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (member: Member) => {
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    const before = commentText.slice(0, lastAt);
    const after = commentText.slice(cursorPos);
    const newText = `${before}@${member.full_name} ${after}`;
    setCommentText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render comment content with highlighted @mentions
  const renderContent = (content: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    for (const m of members) {
      const mention = `@${m.full_name}`;
      const segments = remaining.split(mention);
      if (segments.length > 1) {
        remaining = segments.join(mention); // reset, we'll process inline
      }
    }

    // Simple regex for @Name
    const regex = /@(\S+(?:\s\S+)*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const matchedName = match[1];
      const isMember = members.some((m) => matchedName.startsWith(m.full_name));
      if (isMember) {
        const memberMatch = members.find((m) => matchedName.startsWith(m.full_name))!;
        if (match.index > lastIndex) {
          parts.push(<span key={key++}>{content.slice(lastIndex, match.index)}</span>);
        }
        parts.push(
          <span key={key++} className="text-primary font-medium">
            @{memberMatch.full_name}
          </span>
        );
        lastIndex = match.index + 1 + memberMatch.full_name.length;
        regex.lastIndex = lastIndex;
      }
    }
    if (lastIndex < content.length) {
      parts.push(<span key={key++}>{content.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass border-border/50 max-w-lg max-h-[85vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground">
            {task.name}
          </DialogTitle>
        </DialogHeader>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0.5 border", statusColors[task.status])}
          >
            {statusLabels[task.status]}
          </Badge>
          {task.ad_id && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 border bg-purple-500/20 text-purple-400 border-purple-500/30"
            >
              <Palette className="h-2.5 w-2.5 mr-0.5" />
              Criativo
            </Badge>
          )}
          {task.drive_link && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 border bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/30 transition-colors"
              onClick={() => window.open(task.drive_link, "_blank")}
            >
              <ExternalLink className="h-2.5 w-2.5 mr-0.5" />
              Drive
            </Badge>
          )}
          {task.project_name && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 border bg-accent/50 text-accent-foreground border-border/50"
            >
              <FolderOpen className="h-2.5 w-2.5 mr-0.5" />
              {task.project_name}
            </Badge>
          )}
          {task.remessa_name && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 border bg-sky-500/20 text-sky-400 border-sky-500/30"
            >
              {task.remessa_name}
            </Badge>
          )}
          {task.assigned_name && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0.5 border bg-orange-500/20 text-orange-400 border-orange-500/30"
            >
              <User className="h-2.5 w-2.5 mr-0.5" />
              {task.assigned_name}
            </Badge>
          )}
        </div>

        <Separator className="bg-border/50" />

        {/* Details */}
        <div className="space-y-3">
          {task.description && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <FileText className="h-3 w-3" />
                Descrição
              </div>
              <p className="text-2xs text-foreground/80 leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {task.assigned_name && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <User className="h-3 w-3" />
                  Atribuída a
                </div>
                <p className="text-2xs text-foreground/80">{task.assigned_name}</p>
              </div>
            )}

            {task.due_date && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <CalendarDays className="h-3 w-3" />
                  Prazo
                </div>
                <p className="text-2xs text-foreground/80">
                  {format(parseISO(task.due_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3 w-3" />
                Criada em
              </div>
              <p className="text-2xs text-foreground/80">
                {format(parseISO(task.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>

          {task.link && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-2xs gap-1.5 border-border/50 bg-secondary/30 hover:bg-secondary/50"
              onClick={() => window.open(task.link, "_blank")}
            >
              <ExternalLink className="h-3 w-3" />
              Acessar Pasta
            </Button>
          )}
        </div>

        <Separator className="bg-border/50" />

        {/* Comments Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            <MessageSquare className="h-3 w-3" />
            Comentários ({comments.length})
          </div>

          <ScrollArea className="flex-1 max-h-48 pr-1">
            {comments.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60 py-4 text-center">
                Nenhum comentário ainda
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="group space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-foreground">
                        {c.user_name}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        {formatDistanceToNow(parseISO(c.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                      {currentUserId === c.user_id && (
                        <button
                          onClick={() => handleDeleteComment(c)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-muted-foreground hover:text-destructive"
                          title="Excluir comentário"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {c.audio_url && (
                      <button
                        onClick={() => togglePlayAudio(c.id, c.audio_url!)}
                        className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 mt-1 transition-colors hover:bg-primary/20"
                      >
                        {playingAudioId === c.id ? (
                          <Pause className="h-3 w-3 text-primary" />
                        ) : (
                          <Play className="h-3 w-3 text-primary" />
                        )}
                        <span className="text-[10px] text-primary font-medium">Áudio</span>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-0.5 rounded-full bg-primary/40",
                                playingAudioId === c.id ? "animate-pulse" : ""
                              )}
                              style={{ height: `${8 + Math.random() * 8}px` }}
                            />
                          ))}
                        </div>
                      </button>
                    )}
                    {c.content && c.content !== "🎤 Áudio" && (
                      <p className="text-2xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {renderContent(c.content)}
                      </p>
                    )}
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Comment Input */}
          <div className="relative mt-2">
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 w-full glass border border-border/50 rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
                {filteredMembers.map((m, i) => (
                  <button
                    key={m.user_id}
                    onClick={() => insertMention(m)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-2xs flex items-center gap-2 transition-colors",
                      i === mentionIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <User className="h-3 w-3 shrink-0" />
                    {m.full_name}
                  </button>
                ))}
              </div>
            )}
            {/* Audio preview */}
            {audioUrl && !isRecording && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-3 py-2 mb-2">
                <button onClick={() => togglePlayAudio("preview", audioUrl)} className="text-primary">
                  {playingAudioId === "preview" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <div className="flex-1 h-1 bg-primary/20 rounded-full">
                  <div className="h-full w-1/2 bg-primary rounded-full" />
                </div>
                <span className="text-[10px] text-primary font-medium">{formatTime(recordingTime)}</span>
                <button onClick={discardAudio} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] text-destructive font-medium">Gravando... {formatTime(recordingTime)}</span>
                <div className="flex-1" />
                <Button size="sm" variant="destructive" onClick={stopRecording} className="h-7 px-2 text-[10px]">
                  <Square className="h-3 w-3 mr-1" />
                  Parar
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Escreva um comentário... Use @ para mencionar"
                className="flex-1 text-2xs bg-secondary/30 border border-border/50 rounded-md px-3 py-2 resize-none min-h-[36px] max-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                rows={1}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={sending}
                className={cn(
                  "h-9 w-9 p-0 shrink-0",
                  isRecording && "border-destructive text-destructive hover:bg-destructive/10",
                  audioBlob && !isRecording && "border-primary text-primary"
                )}
              >
                {isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || (!commentText.trim() && !audioBlob)}
                className="h-9 w-9 p-0 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
