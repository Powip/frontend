"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/layout/avatar";
import PowipLogo from "@/components/layout/logo";
import { SUPERADMIN_NAV } from "@/config/superadminNav.config";

function accountInitials(name?: string, surname?: string): string {
  const n = name?.trim()?.[0] ?? "";
  const s = surname?.trim()?.[0] ?? "";
  return (n + s).toUpperCase() || "SA";
}

export function SuperadminSidebar() {
  const pathname = usePathname();
  const { auth } = useAuth();
  const items = SUPERADMIN_NAV;

  const fullName = auth?.user.name ? `${auth.user.name} ${auth.user.surname || ""}`.trim() : "Super Admin";

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Link href="/dashboard" className="flex items-center">
          <PowipLogo className="w-[92px] h-auto text-primary" />
        </Link>
        <span className="rounded-md bg-sidebar-primary/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-sidebar-primary">
          Admin
        </span>
      </div>

      <div className="px-5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Centro de control
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-sidebar-primary/15 text-sidebar-primary"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://www.svgrepo.com/show/17068/user.svg" alt={fullName} />
            <AvatarFallback className="text-[11px] font-bold">{accountInitials(auth?.user.name, auth?.user.surname)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">{fullName}</div>
            <div className="truncate text-[10.5px] text-muted-foreground">{auth?.user.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
