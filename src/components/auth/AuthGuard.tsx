"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { hasRouteAccess, isSuperadmin } from "@/config/permissions.config";
import { PowipPulseLoader } from "@/components/shared/PowipPulseLoader";
import { resolveSubscriptionRedirect } from "@/lib/subscriptionGate";

interface AuthGuardProps {
  children: ReactNode;
}

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = [
  "/login",
  "/restablecer-contrasena",
  "/subscriptions",
  "/rastreo",
  "/onboarding",
];

/**
 * Componente que protege rutas autenticadas y verifica permisos.
 * Espera a que el contexto termine de cargar antes de verificar autenticación.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { auth, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Verificar si es una ruta pública
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  // Misma regla que usa el Sidebar para mostrar el enlace (ver hasRouteAccess).
  const hasAccess = pathname ? hasRouteAccess(pathname, auth?.user) : true;

  // Sin pago no se entra (FEAT-11): usuarios sin empresa van a elegir/pagar un
  // plan o, si ya pagaron, a crear su empresa. Ver lib/subscriptionGate.ts.
  const gateRedirect =
    !loading && auth && !isPublicRoute && pathname
      ? resolveSubscriptionRedirect({
          pathname,
          isSuperadmin: isSuperadmin(auth.user?.email),
          hasCompany: !!auth.company || !!auth.user?.companyId,
          subscriptionStatus: auth.subscription?.status,
        })
      : null;

  useEffect(() => {
    // Si no está cargando, no hay auth, y NO es ruta pública -> login
    if (!loading && !auth && !isPublicRoute) {
      router.push("/login");
      return;
    }
    if (gateRedirect) {
      router.replace(gateRedirect);
    }
  }, [auth, loading, router, isPublicRoute, gateRedirect]);

  // Rutas públicas: renderizar directamente
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Mientras carga, mostrar el loader — es lo primero que se ve en cada
  // recarga completa de la app (F5), antes de que se resuelva la sesión.
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <PowipPulseLoader label="Cargando..." />
      </div>
    );
  }

  // Si no está autenticado (después de cargar), no renderizar nada
  if (!auth) {
    return null;
  }

  // Redirigiendo por falta de plan/empresa: no mostrar la página de destino.
  if (gateRedirect) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <PowipPulseLoader label="Cargando..." />
      </div>
    );
  }

  // Si está autenticado pero no tiene permisos para esta ruta
  if (!hasAccess) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          Acceso Denegado
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          No tienes permisos para acceder a esta página.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Ir al Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
