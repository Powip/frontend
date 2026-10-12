"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { Fragment } from "react";
import { BusinessScopeProvider, useBusinessScope } from "@/contexts/BusinessScopeContext";
import { BusinessScopeBar } from "@/components/header/BusinessScopeBar";
import { isBusinessScopeRoute, shouldResetBusinessView } from "@/lib/businessScopeRoutes";

export default function AppContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BusinessScopeProvider><ScopedAppContainer>{children}</ScopedAppContainer></BusinessScopeProvider>;
}

function ScopedAppContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const { scopeKey } = useBusinessScope();
  const viewKey = shouldResetBusinessView(pathname) ? scopeKey : JSON.stringify([auth?.company?.id, auth?.user?.id]);

  const noSidebarRoutes = [
    "/login",
    "/restablecer-contrasena",
    "/new-company",
    "/subscriptions",
    "/rastreo",
    "/onboarding",
  ];

  const hideSidebar =
    pathname === "/configuracion/integraciones/publicidad/callback" ||
    noSidebarRoutes.some((r) => pathname.startsWith(r)) ||
    (!auth && pathname === "/partners/solicitud");

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <main className="flex-1 bg-gray-light overflow-auto">
          {!hideSidebar && isBusinessScopeRoute(pathname) && <BusinessScopeBar />}
          <Fragment key={viewKey}>{children}</Fragment>
        </main>
      </div>
    </AuthGuard>
  );
}
