"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole } from "@/config/superadminNav.config";
import { useSuperadminRole } from "./SuperadminRoleContext";
import { ROL_LABEL } from "@/interfaces/superadmin";

export function SuperadminSidebar() {
  const pathname = usePathname();
  const { viewingAs } = useSuperadminRole();
  const items = navForRole(viewingAs);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-extrabold text-sm shadow-sm">
          P
        </div>
        <div>
          <div className="text-base font-extrabold tracking-tight">POWIP</div>
          <div className="text-[11px] text-muted-foreground -mt-0.5">Super Admin</div>
        </div>
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
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2.5 text-xs text-sidebar-accent-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
          <span>
            Estás viendo como <b>{ROL_LABEL[viewingAs]}</b>
          </span>
        </div>
      </div>
    </aside>
  );
}
