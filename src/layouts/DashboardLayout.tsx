import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/contexts/ThemeContext";

const DashboardLayout = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  // Light mode keeps the sidebar collapsed (icon rail) with no expand option.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let active = true;

    // Restore the persisted session (refreshes the token if needed). Only this
    // decides the initial redirect — avoids bouncing to /login on a transient
    // null from the auth listener during cold start (e.g. reopening the PWA).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        // Preserve the intended URL (e.g. a shared swipe deep link) so login returns here.
        const target = location.pathname + location.search;
        const q = target && target !== "/dashboard" ? `?redirect=${encodeURIComponent(target)}` : "";
        navigate(`/login${q}`, { replace: true });
      }
      setLoading(false);
    });

    // After that, only react to an explicit sign-out.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login", { replace: true });
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Mobile: bottom-tab navigation (Hoje / Em breve / Navegar), no side drawer.
  if (isMobile) {
    return (
      <ProjectProvider>
        <div
          className="flex flex-col h-[100dvh] w-full overflow-hidden"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-24 [&:has(>.chat-page)]:p-0 [&:has(>.chat-page)]:overflow-hidden">
            <Outlet />
          </main>
          <MobileBottomNav />
        </div>
      </ProjectProvider>
    );
  }

  // Desktop: sidebar layout.
  return (
    <ProjectProvider>
      <SidebarProvider
        open={theme === "light" || theme === "special" ? false : sidebarOpen}
        onOpenChange={setSidebarOpen}
        style={theme === "light" || theme === "special" ? ({ "--sidebar-width-icon": "3.9rem" } as CSSProperties) : undefined}
      >
        <div className="h-screen flex w-full overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <main className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto overflow-x-hidden p-6 [&:has(>.chat-page)]:p-0 [&:has(>.chat-page)]:overflow-hidden">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
};

export default DashboardLayout;
