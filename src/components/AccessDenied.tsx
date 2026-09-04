import { Lock } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-3">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">Você não tem acesso a esta área</p>
    </div>
  );
}
