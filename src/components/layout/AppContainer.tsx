"use client";

import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import { BusinessScopeBar } from "@/components/header/BusinessScopeBar";
import { Sidebar } from "@/components/layout/Sidebar";
import FlowMigrationBanner from "@/components/subscription/FlowMigrationBanner";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessScopeProvider, useBusinessScope } from "@/contexts/BusinessScopeContext";
import { isBusinessScopeRoute, shouldResetBusinessView } from "@/lib/businessScopeRoutes";

const publicAuthFlowRoutes = ["/onboarding", "/login", "/restablecer-contrasena"];
const advertisingCallbackRoute = "/configuracion/integraciones/publicidad/callback";

export default function AppContainer({ children }: { children: React.ReactNode }) {
  return (
    <BusinessScopeProvider>
      <ScopedAppContainer>{children}</ScopedAppContainer>
    </BusinessScopeProvider>
  );
}

function ScopedAppContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { auth } = useAuth();
  const { scopeKey } = useBusinessScope();
  const userId = auth?.user?.id;
  const [publicSession, setPublicSession] = useState({ userId, revision: 0 });
  let publicSessionRevision = publicSession.revision;

  // Creating the first session must keep the public flow's state. Once signed
  // in, logout or switching accounts must discard the previous user's flow data.
  // Adjust before rendering children so another account never sees that state.
  if (publicSession.userId !== userId) {
    if (publicSession.userId !== undefined) publicSessionRevision += 1;
    setPublicSession({ userId, revision: publicSessionRevision });
  }

  const isPublicAuthFlow = pathname === advertisingCallbackRoute || publicAuthFlowRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const viewKey = isPublicAuthFlow
    ? JSON.stringify(["public-auth-flow", pathname, publicSessionRevision])
    : shouldResetBusinessView(pathname)
      ? scopeKey
      : JSON.stringify([auth?.company?.id, userId]);

  const noSidebarRoutes = [
    "/login",
    "/restablecer-contrasena",
    "/new-company",
    "/subscriptions",
    "/rastreo",
    "/c/",
    "/onboarding",
    "/pasate-a-flow",
    "/cuenta-suspendida",
  ];

  const hideSidebar =
    pathname === advertisingCallbackRoute ||
    noSidebarRoutes.some((r) => pathname.startsWith(r)) ||
    (!auth && pathname === "/partners/solicitud");

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <main className="flex-1 bg-gray-light overflow-auto">
          {!hideSidebar && <FlowMigrationBanner />}
          {!hideSidebar && isBusinessScopeRoute(pathname) && <BusinessScopeBar />}
          <Fragment key={viewKey}>{children}</Fragment>
        </main>
      </div>
    </AuthGuard>
  );
}
