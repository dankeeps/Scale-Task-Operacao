import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) fetchProfile();
  }, [open]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, telegram_chat_id")
      .eq("id", user.id)
      .single();

    if (data) {
      setFullName(data.full_name || "");
      setAvatarUrl(data.avatar_url);
      setTelegramChatId((data as any).telegram_chat_id || "");
    } else {
      // Profile doesn't exist yet (existing user before trigger), create it
      await supabase.from("profiles").insert({
        id: user.id,
        full_name: user.email?.split("@")[0] || "",
      });
      setFullName(user.email?.split("@")[0] || "");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from("profiles")
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      setAvatarUrl(url);
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), telegram_chat_id: telegramChatId.trim() || null, updated_at: new Date().toISOString() } as any)
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Nome atualizado!");
    } catch {
      toast.error("Erro ao atualizar nome");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha atualizada!");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toast.error("Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  };

  const initials = fullName
    ? fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Meu Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-sm bg-secondary text-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <div className="flex gap-2">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-8 text-xs bg-secondary/30 border-border/50"
                placeholder="Seu nome"
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={loading}
                className="h-8 text-xs px-3"
              >
                Salvar
              </Button>
            </div>
          </div>

          {/* Telegram Chat ID */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telegram Chat ID</Label>
            <Input
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="h-8 text-xs bg-secondary/30 border-border/50"
              placeholder="Ex: 7557825457"
            />
            <p className="text-[10px] text-muted-foreground">
              Envie /start para @Slvanessa_bot e use o chat ID recebido.
            </p>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-8 text-xs bg-secondary/30 border-border/50"
              placeholder="Mínimo 6 caracteres"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleChangePassword}
              disabled={loading || !newPassword}
              className="w-full h-8 text-xs mt-1"
            >
              Alterar senha
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
