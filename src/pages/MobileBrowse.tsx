import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare, ChevronRight, Settings as SettingsIcon,
  User, LogOut, FolderOpen, ChevronDown, Check, Lock, Highlighter,
  Archive, LayoutGrid, Clapperboard, MessageSquare, Files, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationPopover } from "@/components/NotificationPopover";
import { ProfileDialog } from "@/components/ProfileDialog";
import { SettingsDialog } from "@/components/SettingsDialog";

const MENU = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutGrid, tab: "dashboard" },
  { title: "Task", url: "/dashboard/tasks", icon: CheckSquare, tab: "tasks" },
  { title: "Criativos", url: "/dashboard/criativos", icon: Clapperboard, tab: "criativos" },
  { title: "Swipe", url: "/dashboard/swipe", icon: Files, tab: "swipe" },
  { title: "Arquivos", url: "/dashboard/arquivos", icon: Archive, tab: "arquivos" },
  { title: "Educacional", url: "/dashboard/educacional", icon: BookOpen, tab: "educacional" },
];

const MobileBrowse = () => {
  const navigate = useNavigate();
  const { projects, currentProject, selectProject } = useProjectContext();
  const { canAccessTab } = useCurrentUserRole();
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("avatar_url, full_name").eq("id", user.id).single().then(({ data }) => {
          if (data) { setUserAvatar(data.avatar_url); setUserName(data.full_name || ""); }
        });
      }
    });
  }, [showProfile]);

  const items = MENU.filter((i) => canAccessTab(i.tab));

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Top bar: user + actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowProfile(true)}
          className="flex items-center gap-2.5 rounded-full pl-1 pr-4 py-1 hover:bg-secondary/50 transition-colors"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={userAvatar || undefined} alt={userName} />
            <AvatarFallback className="text-sm">{userName.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <span className="text-base font-semibold text-foreground truncate max-w-[45vw]">{userName || "Perfil"}</span>
        </button>
        <div className="flex items-center gap-1">
          <NotificationPopover collapsed />
          <button
            onClick={() => setShowSettings(true)}
            className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Project selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 text-left">
            {currentProject?.image_url ? (
              <img src={currentProject.image_url} alt="" className="h-8 w-8 rounded-md object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Projeto atual</p>
              <p className="text-sm font-medium text-foreground truncate">{currentProject?.name || "Selecionar"}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[90vw] max-w-sm glass border-border/50">
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => selectProject(p)}
              className={cn("gap-2 cursor-pointer text-sm py-2", p.id === currentProject?.id && "text-primary")}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-5 w-5 rounded object-cover" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )}
              <span className="flex-1 truncate">{p.name}</span>
              {p.id === currentProject?.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Menu */}
      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        {items.map((item, i) => {
          const hasAccess = canAccessTab(item.tab);
          return (
            <button
              key={item.tab}
              onClick={() => hasAccess && navigate(item.url)}
              disabled={!hasAccess}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                i !== items.length - 1 && "border-b border-border/40",
                hasAccess ? "hover:bg-secondary/40 text-foreground" : "text-muted-foreground/40",
              )}
            >
              <item.icon className="h-5 w-5 text-primary shrink-0" />
              <span className="flex-1 text-sm">{item.title}</span>
              {hasAccess ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              ) : (
                <Lock className="h-4 w-4 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Account */}
      <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <button
          onClick={() => setShowProfile(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-border/40 hover:bg-secondary/40 transition-colors"
        >
          <User className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm text-foreground">Perfil</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40 transition-colors"
        >
          <LogOut className="h-5 w-5 text-destructive shrink-0" />
          <span className="flex-1 text-sm text-destructive">Sair</span>
        </button>
      </div>

      <ProfileDialog open={showProfile} onOpenChange={setShowProfile} />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
};

export default MobileBrowse;
