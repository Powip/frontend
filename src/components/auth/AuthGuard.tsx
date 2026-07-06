"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, ReactNode } from "react";
import { getRoutePermissions, hasAnyPermission, isSuperadmin, hasAdminAccess } from "@/config/permissions.config";

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

// Rutas accesibles con auth pero SIN suscripción activa
const SUBSCRIPTION_EXEMPT_ROUTES = [
  "/sin-plan",
  "/new-company",
];

/**
 * Componente que protege rutas autenticadas y verifica permisos.
 * Espera a que el contexto termine de cargar antes de verificar autenticación.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { auth, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = useMemo(
    () => PUBLIC_ROUTES.some(route => pathname?.startsWith(route)),
    [pathname],
  );
  const isSubscriptionExempt = useMemo(
    () => SUBSCRIPTION_EXEMPT_ROUTES.some(route => pathname?.startsWith(route)),
    [pathname],
  );

  const requiredPermissions = pathname ? getRoutePermissions(pathname) : [];

  const hasAccess = isSuperadmin(auth?.user?.email) ||
    (requiredPermissions.includes("__SUPERADMIN__")
      ? false // isSuperadmin ya cubre el caso true arriba; si llegó acá, no es superadmin
      : requiredPermissions.includes("__ADMIN_ROLE__")
        ? hasAdminAccess(auth?.user?.role)
        : hasAnyPermission(auth?.user?.permissions, requiredPermissions));

  // TEMPORAL: restricción de suscripción deshabilitada
  const hasSubscription = true;

  useEffect(() => {
    if (loading) return;

    // Usuario completamente autenticado que accede al flujo de registro directamente
    if (auth && auth.subscription && pathname?.startsWith("/onboarding")) {
      router.push("/dashboard");
      return;
    }

    if (!auth && !isPublicRoute) {
      router.push("/login");
      return;
    }

    if (auth && !isPublicRoute && !isSubscriptionExempt && !hasSubscription) {
      router.push("/sin-plan");
    }
  }, [auth, loading, router, pathname, isPublicRoute, isSubscriptionExempt, hasSubscription]);

  // Rutas públicas: renderizar directamente
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Mientras carga, mostrar spinner
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si no está autenticado (después de cargar), no renderizar nada
  if (!auth) {
    return null;
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
