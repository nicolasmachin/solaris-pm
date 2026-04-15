import type { ReactNode } from "react";
import { usePermission } from "../../hooks/usePermission";

interface CanAccessProps {
  module: string;
  action: string;
  children: ReactNode;
}

export function CanAccess({ module, action, children }: CanAccessProps) {
  const allowed = usePermission(module, action);
  if (!allowed) return null;
  return <>{children}</>;
}
