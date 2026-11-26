"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import Header from "@/components/header/Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminPeriodProvider, useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { AdminPeriodControl } from "./_components/AdminPeriodControl";
import { SECCIONES_ADMIN, ubicarPagina } from "./_components/secciones";
import { Aviso } from "./_components/ui";
import { etiquetaPeriodo, hoyLima, rangoDePreset } from "./_lib/periodo";

const CONTENIDO_ID = "administracion-contenido";

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { fromDate, toDate } = useAdminPeriod();
  const { auth, loading, hasPermission } = useAuth();
  const ubicacion = ubicarPagina(pathname ?? "");

  useEffect(() => {
    if (loading) return;
    if (!auth || !hasPermission("VIEW_FINANCES")) {
      router.replace("/dashboard");
    }
  }, [auth, loading, hasPermission, router]);

  if (loading || !auth || !hasPermission("VIEW_FINANCES")) return null;

  return (
    <div className="flex h-full min-w-0 max-w-full flex-col bg-pc-bg">
      <Header />
      <TooltipProvider delayDuration={200}>
        <div className="min-w-0 flex-1 overflow-auto bg-pc-bg font-sans text-[13px] text-pc-text">
          <header className="border-b border-pc-border bg-pc-card px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-auto min-w-0">
                <h1 className="whitespace-nowrap text-lg font-extrabold tracking-wide text-pc-text sm:text-xl">
                  ADMINISTRACIÓN
                </h1>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-pc-text-muted">
                  Finanzas del negocio · todos los canales
                </p>
              </div>
              <AdminPeriodControl />
            </div>
          </header>

          <nav
            aria-label="Secciones de administración"
            className="sticky top-0 z-20 border-b border-pc-border bg-pc-card"
          >
            <ul className="flex gap-0.5 overflow-x-auto px-4 sm:px-5">
              {SECCIONES_ADMIN.map((seccion) => {
                const activa = ubicacion?.seccion.id === seccion.id;
                return (
                  <li key={seccion.id}>
                    <Link
                      href={seccion.paginas[0].href}
                      aria-current={activa ? "true" : undefined}
                      className={cn(
                        "block whitespace-nowrap border-b-[3px] px-3.5 py-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pc-primary",
                        activa
                          ? "border-pc-primary font-semibold text-pc-text"
                          : "border-transparent font-medium text-pc-text-muted hover:text-pc-primary",
                      )}
                    >
                      {seccion.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main id={CONTENIDO_ID} className="px-4 pb-16 pt-4 outline-none sm:px-6 sm:pt-5">
            <p className="mb-3 text-[11px] text-pc-text-muted">
              <span className="font-semibold text-pc-text">{etiquetaPeriodo(fromDate, toDate)}</span> · hora Lima ·
              una venta es un pedido entregado y se cuenta en el día en que se entregó
            </p>
            {ubicacion && (
              <>
                <div className="mb-4 min-w-0">
                  <h2 className="text-lg font-extrabold text-pc-text">{ubicacion.pagina.titulo}</h2>
                  <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-pc-text-muted">
                    {ubicacion.pagina.subtitulo}
                  </p>
                </div>
                {ubicacion.seccion.paginas.length > 1 && ubicacion.enMenu && (
                  <ul aria-label={`Subsecciones de ${ubicacion.seccion.label}`} className="mb-4 flex flex-wrap gap-1.5">
                    {ubicacion.seccion.paginas.map((pagina) => {
                      const activa = pagina.href === ubicacion.pagina.href;
                      return (
                        <li key={pagina.href}>
                          <Link
                            href={pagina.href}
                            aria-current={activa ? "page" : undefined}
                            className={cn(
                              "block whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-pc-primary",
                              activa
                                ? "border-pc-primary bg-pc-primary font-semibold text-pc-on-fill"
                                : "border-pc-border bg-pc-card font-medium text-pc-text-muted hover:text-pc-primary",
                            )}
                          >
                            {pagina.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!ubicacion.enMenu && (
                  <Aviso tono="warn" className="mb-4" titulo="Esta sección no está en el menú">
                    Sus datos se guardan solo en este navegador: otro usuario u otra computadora no los ve. Vuelve al
                    menú cuando tenga respaldo en el servidor.
                  </Aviso>
                )}
                {ubicacion.enMenu && ubicacion.pagina.soloNavegador && (
                  <Aviso tono="warn" className="mb-4" titulo="Los datos de esta sección se guardan solo en este navegador">
                    Otro usuario u otra computadora no los ve, y se pierden si se borran los datos del navegador.
                  </Aviso>
                )}
              </>
            )}
            {children}
          </main>
        </div>
      </TooltipProvider>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // «Este mes» hasta hoy: los días futuros no tienen ventas y sí restarían gastos.
  const inicial = useMemo(() => {
    const r = rangoDePreset("mes_actual", hoyLima());
    return { from: r.desde, to: r.hasta };
  }, []);
  return (
    <AdminPeriodProvider initialRange={inicial}>
      <AdminShell>{children}</AdminShell>
    </AdminPeriodProvider>
  );
}
