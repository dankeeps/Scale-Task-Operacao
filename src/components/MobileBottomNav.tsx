import { NavLink } from "react-router-dom";
import { CalendarDays, CalendarClock, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard/hoje", label: "Hoje", icon: CalendarDays },
  { to: "/dashboard/em-breve", label: "Em breve", icon: CalendarClock },
  { to: "/dashboard/navegar", label: "Navegar", icon: LayoutGrid },
];

export function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                isActive ? "text-neon" : "text-muted-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <it.icon className={cn("h-5 w-5", isActive && "icon-neon")} />
                <span className={cn(isActive && "font-medium")}>{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
