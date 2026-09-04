import { ReactNode } from "react";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { AccessDenied } from "@/components/AccessDenied";

interface TabGuardProps {
  tab: string;
  children: ReactNode;
}

export function TabGuard({ tab, children }: TabGuardProps) {
  const { canAccessTab, loading } = useCurrentUserRole();

  if (loading) return null;
  if (!canAccessTab(tab)) return <AccessDenied />;

  return <>{children}</>;
}
