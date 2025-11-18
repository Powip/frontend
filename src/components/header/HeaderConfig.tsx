"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function HeaderConfig({ title, description, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const showBackButtonRoutes = [
    "/configuracion/tiendas",
    "/configuracion/editar-usuario",
    "/configuracion/empresa",
  ];

  const shouldShowBackButton = showBackButtonRoutes.includes(pathname);

  return (
    <div className="p-6">
      <div className="grid grid-cols-3 items-center">
        {/* --- IZQUIERDA --- */}
        <div>
          {shouldShowBackButton && (
            <Link href="/configuracion">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
            </Link>
          )}
        </div>

        {/* --- CENTRO (Título + Descripción) --- */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>

          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* --- DERECHA (Children si existieran) --- */}
        <div className="flex justify-end gap-2">{children}</div>
      </div>
    </div>
  );
}
