"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";

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
 * Componente que protege rutas autenticadas.
 * Espera a que el contexto termine de cargar antes de verificar autenticación.
 * Evita redirecciones prematuras durante la rehidratación del estado.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { auth, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Verificar si es una ruta pública
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

  useEffect(() => {
    // Solo redirigir cuando loading es false, auth es null, y NO es ruta pública
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

  return <>{children}</>;
}
