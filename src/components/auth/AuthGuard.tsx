"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { getRoutePermissions, hasAnyPermission } from "@/config/permissions.config";

interface AuthGuardProps {
  children: ReactNode;
}

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = [
  "/login",
  "/restablecer-contrasena",
  "/subscriptions",
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

  // Obtener permisos requeridos para la ruta actual
  const requiredPermissions = pathname ? getRoutePermissions(pathname) : [];
  
  // Verificar si el usuario tiene acceso
  const hasAccess = requiredPermissions.length === 0 || 
    hasAnyPermission(auth?.user?.permissions, requiredPermissions);

  useEffect(() => {
    // Si no está cargando, no hay auth, y NO es ruta pública -> login
    if (!loading && !auth && !isPublicRoute) {
      router.push("/login");
    }
  }, [auth, loading, router, isPublicRoute]);

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
