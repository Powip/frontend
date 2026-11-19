"use client";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/config/permissions.config";
import { ADMIN_ONLY_NOTICE } from "./ContentLib";

/** Muestra el contenido solo a administradores; a los demás, un aviso. */
export default function ContentAdminGate({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  if (!hasAdminAccess(auth?.user?.role)) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" /> {ADMIN_ONLY_NOTICE}.
      </p>
    );
  }
  return <>{children}</>;
}
