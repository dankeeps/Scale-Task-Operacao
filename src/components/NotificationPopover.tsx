import { useNotifications } from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  collapsed?: boolean;
  variant?: "row" | "icon";
}

export function NotificationPopover({ collapsed = false, variant = "row" }: Props) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <button className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-background" />
            )}
          </button>
        ) : (
          <button className="relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Notificações</span>}
            {unreadCount > 0 && (
              <span className="absolute top-0.5 left-5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        className="glass border-border/50 w-80 p-0"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-2xs font-semibold text-foreground">Notificações</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar tudo como lido
            </button>
          )}
        </div>

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-2xs text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 border-b border-border/30 transition-colors hover:bg-secondary/40",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.read && (
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <div className={cn("flex-1 min-w-0", n.read && "ml-3.5")}>
                    <p className="text-[11px] font-medium text-foreground">{n.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(parseISO(n.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
