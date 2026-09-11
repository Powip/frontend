"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/layout/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAlertasImportantes } from "@/hooks/superadmin/useDashboard";
import { relativeTime } from "@/components/superadmin/shared/format";

export function SuperadminTopbar() {
  const { auth, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const { data: alertasData } = useAlertasImportantes();
  const alertas = alertasData?.data;

  const fullName = auth?.user.name ? `${auth.user.name} ${auth.user.surname || ""}`.trim() : "Super Admin";
  const initials = auth?.user.name
    ? auth.user.name.substring(0, 1).toUpperCase() + (auth.user.surname ? auth.user.surname.substring(0, 1).toUpperCase() : "")
    : "SA";

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background/95 backdrop-blur px-6 py-3">
      <div className="ml-auto flex items-center gap-2.5">
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
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://www.svgrepo.com/show/17068/user.svg" alt={fullName} />
                <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold leading-tight">{fullName}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">Super Admin</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold">{fullName}</span>
              <span className="text-[11px] font-normal text-muted-foreground">{auth?.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard")}>Volver a POWIP</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive">
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
