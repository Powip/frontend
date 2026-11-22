"use client";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useCrmMe } from "@/hooks/useCrmMe";
import { ADMIN_ONLY_NOTICE } from "./ContentLib";

/** Muestra el contenido solo a administradores; a los demás, un aviso. */
export default function ContentAdminGate({ children }: { children: ReactNode }) {
  const { isAdmin } = useCrmMe();
  if (!isAdmin) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-md border bg-muted p-3 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" /> {ADMIN_ONLY_NOTICE}.
      </p>
    );
  }
  return <>{children}</>;
}
