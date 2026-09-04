import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { NavLink } from "@/components/NavLink";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { ProfileDialog } from "@/components/ProfileDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { NotificationPopover } from "@/components/NotificationPopover";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckSquare, LogOut, Zap, FolderOpen, ChevronDown, Plus, Check, User, Settings, Archive, Lock, Highlighter, LayoutGrid, Clapperboard, MessageSquare, Files, BookOpen, Sun, Moon, Sparkles, SunMedium, BarChart3 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

const allMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutGrid, tab: "dashboard" },
  { title: "Task", url: "/dashboard/tasks", icon: CheckSquare, tab: "tasks" },
  { title: "Criativos", url: "/dashboard/criativos", icon: Clapperboard, tab: "criativos" },
  { title: "Swipe", url: "/dashboard/swipe", icon: Files, tab: "swipe" },
  { title: "Arquivos", url: "/dashboard/arquivos", icon: Archive, tab: "arquivos" },
  { title: "Educacional", url: "/dashboard/educacional", icon: BookOpen, tab: "educacional" },
];

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  // On the mobile drawer, scale everything up for comfortable touch targets.
  const iconCls = isMobile ? "h-5 w-5" : "h-3.5 w-3.5";
  const rowText = isMobile ? "text-sm" : "text-2xs";
  const navigate = useNavigate();
  const { projects, currentProject, selectProject, addProject } = useProjectContext();
  const { canAccessTab } = useCurrentUserRole();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("avatar_url, full_name").eq("id", user.id).single().then(({ data }) => {
          if (data) {
            setUserAvatar(data.avatar_url);
            setUserName(data.full_name || "");
          }
        });
      }
    });
  }, [showProfile]); // refresh after profile dialog closes
  
  const menuItems = allMenuItems.filter((item) => canAccessTab(item.tab));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: project, error } = await supabase
        .from("projects")
        .insert({ name: newProjectName.trim(), created_by: user.id })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("user_projects")
        .insert({ user_id: user.id, project_id: project.id, role: "owner" });

      addProject({ id: project.id, name: project.name, role: "owner" });
      setNewProjectName("");
      setShowNewProject(false);
      toast.success("Projeto criado!");
    } catch {
      toast.error("Erro ao criar projeto.");
    } finally {
      setCreatingProject(false);
    }
  };

  // Light & Special modes: floating icon rail with a short label under each icon.
  const rail = theme === "light" || theme === "special";

  return (
    <Sidebar collapsible="icon" variant={rail ? "floating" : "sidebar"} className="border-r-0">
      {/* Workspace + notifications + collapse */}
      <div className={cn("flex items-center gap-1 py-2", collapsed ? "flex-col px-1" : "px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex items-center rounded-md text-foreground transition-colors hover:bg-secondary/60 min-w-0",
              rowText,
              collapsed ? "justify-center p-1.5" : "flex-1 gap-2 px-2 py-1.5"
            )}>
              {currentProject?.image_url ? (
                <img src={currentProject.image_url} alt="" className="h-7 w-7 min-h-7 min-w-7 rounded-full shrink-0 object-cover" />
              ) : (
                <div className="h-7 w-7 min-h-7 min-w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{currentProject?.name || "Projeto"}</span>
                  <ChevronDown className={cn("text-muted-foreground", isMobile ? "h-4 w-4" : "h-3 w-3")} />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 glass border-border/50 p-1">
            <DropdownMenuLabel className="text-2xs text-muted-foreground px-2 py-1">Projetos</DropdownMenuLabel>
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => selectProject(project)}
                className={`text-2xs cursor-pointer gap-2 ${project.id === currentProject?.id ? "text-primary bg-secondary/40" : "text-foreground"}`}
              >
                {project.image_url ? (
                  <img src={project.image_url} alt="" className="h-5 w-5 rounded shrink-0 object-cover" />
                ) : (
                  <FolderOpen className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate flex-1">{project.name}</span>
                {project.id === currentProject?.id && (
                  <Check className="h-3 w-3 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              onClick={() => setShowNewProject(true)}
              className="text-2xs cursor-pointer gap-2 text-primary"
            >
              <Plus className="h-3 w-3 shrink-0" />
              <span>Novo projeto</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationPopover variant="icon" />
        {!rail && (
          <SidebarTrigger className="h-8 w-8 text-muted-foreground shrink-0" />
        )}

        <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
          <DialogContent className="glass border-border/50 sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">Novo Projeto</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                placeholder="Nome do projeto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="h-8 text-2xs bg-secondary/30 border-border/50"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewProject(false)}
                  className="px-3 py-1.5 text-2xs rounded-md text-muted-foreground hover:bg-secondary/60 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || creatingProject}
                  className="px-3 py-1.5 text-2xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creatingProject ? "Criando..." : "Criar"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const hasAccess = canAccessTab(item.tab);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={rail ? "rounded-[10px]" : cn("rounded-[5px]", isMobile ? "h-11" : "h-8")}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={cn(
                          "transition-colors",
                          rail
                            ? "flex flex-col items-center justify-center gap-1 py-2 rounded-[10px]"
                            : cn("flex items-center rounded-[5px]", rowText, isMobile ? "gap-3 px-3" : "gap-2.5 px-2.5"),
                          hasAccess
                            ? "text-muted-foreground hover:bg-secondary/60"
                            : "text-muted-foreground/40 cursor-default"
                        )}
                        activeClassName={hasAccess ? "bg-secondary text-foreground" : ""}
                      >
                        <item.icon className={cn("shrink-0", rail ? "h-[18px] w-[18px]" : iconCls)} />
                        {rail ? (
                          <span className="text-[9px] leading-none text-center w-full truncate px-0.5">
                            {item.title.split(" ")[0]}
                          </span>
                        ) : !collapsed && (
                          <span className="flex-1">{item.title}</span>
                        )}
                        {!hasAccess && !collapsed && (
                          <Lock className={cn("text-muted-foreground/40 ml-auto", isMobile ? "h-4 w-4" : "h-3 w-3")} />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-1">
        <button
          onClick={toggleTheme}
          className={cn("flex w-full items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground", rowText, isMobile ? "gap-3 px-3 py-2.5" : "gap-2.5 px-2.5 py-1.5")}
          title="Alternar tema"
        >
          {/* Icon/label indicate the NEXT theme (dark → light → special → pure → dark) */}
          {theme === "dark" && <Sun className={cn("shrink-0", iconCls)} />}
          {theme === "light" && <Sparkles className={cn("shrink-0", iconCls)} />}
          {theme === "special" && <SunMedium className={cn("shrink-0", iconCls)} />}
          {theme === "pure" && <Moon className={cn("shrink-0", iconCls)} />}
          {!collapsed && (
            <span>{theme === "dark" ? "Modo claro" : theme === "light" ? "Special" : theme === "special" ? "Branco" : "Modo escuro"}</span>
          )}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className={cn("flex w-full items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground", rowText, isMobile ? "gap-3 px-3 py-2.5" : "gap-2.5 px-2.5 py-1.5")}
        >
          <Settings className={cn("shrink-0", iconCls)} />
          {!collapsed && <span>Configurações</span>}
        </button>
        <button
          onClick={handleLogout}
          className={cn("flex w-full items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground", rowText, isMobile ? "gap-3 px-3 py-2.5" : "gap-2.5 px-2.5 py-1.5")}
        >
          <LogOut className={cn("shrink-0", iconCls)} />
          {!collapsed && <span>Sair</span>}
        </button>
        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </SidebarFooter>
    </Sidebar>
  );
}
