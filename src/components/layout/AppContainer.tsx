"use client";

import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import { BusinessScopeBar } from "@/components/header/BusinessScopeBar";
import GreCredentialsNotice from "@/components/gre/GreCredentialsNotice";
import { Sidebar } from "@/components/layout/Sidebar";
import FlowMigrationBanner from "@/components/subscription/FlowMigrationBanner";
import { useAuth } from "@/contexts/AuthContext";
import { BusinessScopeProvider, useBusinessScope } from "@/contexts/BusinessScopeContext";
import { isPublicLiveRoute } from "@/lib/liveRoutes";
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

  const isPublicLive = isPublicLiveRoute(pathname);
  const isPublicAuthFlow = isPublicLive || pathname === advertisingCallbackRoute || publicAuthFlowRoutes.some(
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
    "/completar-negocio",
    "/subscriptions",
    "/rastreo",
    "/c/",
    "/onboarding",
    "/p/",
    "/pasate-a-flow",
    "/cuenta-suspendida",
    // FEAT-24 H6-D: el modo almacén tiene su propio layout móvil.
    "/almacen",
  ];

  const hideSidebar =
    isPublicLive || pathname === advertisingCallbackRoute ||
    noSidebarRoutes.some((r) => pathname.startsWith(r)) ||
    (!auth && pathname === "/partners/solicitud");

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gray-light">
          {!hideSidebar && <FlowMigrationBanner />}
          {!hideSidebar && <GreCredentialsNotice />}
          {!hideSidebar && isBusinessScopeRoute(pathname) && <BusinessScopeBar />}
          {/* Único scroll del contenido: la barra de empresa queda fija arriba. Las páginas que piden
              h-screen ocupan solo el alto que queda, para no sumar otro scroll. «relative» evita que los
              elementos absolutos hagan scrollear el documento. */}
          <div data-testid="app-scroll" className="relative min-h-0 flex-1 overflow-auto [&>.h-screen]:h-full [&>.min-h-screen]:min-h-full">
            <Fragment key={viewKey}>{children}</Fragment>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
