"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Moon, Search, Sun, Eye } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperadminRole } from "./SuperadminRoleContext";
import { ROL_LABEL, RolInterno } from "@/interfaces/superadmin";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { useAlertasImportantes } from "@/hooks/superadmin/useDashboard";
import { relativeTime } from "@/components/superadmin/shared/format";

const ROLES: RolInterno[] = ["super", "ventas", "soporte", "onboarding", "finanzas", "csm"];

export function SuperadminTopbar() {
  const { auth, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { viewingAs, setViewingAs, isPreview } = useSuperadminRole();
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();

  const { data: alertasData } = useAlertasImportantes();
  const alertas = alertasData?.data;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background/95 backdrop-blur px-6 py-3">
      <button
        onClick={() => setSearchOpen(true)}
        className="mx-auto hidden md:flex w-full max-w-md items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/70 transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Buscar empresas, leads, partners, usuarios…</span>
        <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-semibold">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <Select value={viewingAs} onValueChange={(v) => setViewingAs(v as RolInterno)}>
          <SelectTrigger className="h-9 w-[190px] text-xs gap-1.5">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Ver como rol" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                Ver como: {ROL_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              {!!alertas?.length && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                  {alertas.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alertas?.length ? (
              alertas.map((a) => (
                <DropdownMenuItem key={a.id} className="flex flex-col items-start gap-0.5 whitespace-normal py-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={
                        "h-1.5 w-1.5 rounded-full " +
                        (a.severidad === "critical" ? "bg-destructive" : a.severidad === "warning" ? "bg-amber-500" : "bg-blue-500")
                      }
                    />
                    {a.texto}
                  </div>
                  <span className="text-[10px] text-muted-foreground pl-3">{relativeTime(a.ts)}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">Sin notificaciones</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-muted/60 transition-colors">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {auth?.user.name ? auth.user.name.substring(0, 1).toUpperCase() : "P"}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold leading-tight">{auth?.user.name || "Super Admin"}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{ROL_LABEL[viewingAs]}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => router.push("/dashboard")}>Volver a POWIP</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive">
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
