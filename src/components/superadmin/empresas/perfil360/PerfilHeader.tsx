"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, LogIn } from "lucide-react";
import { IEmpresa } from "@/interfaces/superadmin";
import { Button } from "@/components/ui/button";

export function PerfilHeader({ empresa }: { empresa: IEmpresa }) {
  return (
    <div>
      <Link href="/superadmin/empresas" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a Empresas
      </Link>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-sm mb-5">
        <span className={`flex h-14 w-14 items-center justify-center rounded-xl text-xl font-extrabold text-white shrink-0 ${empresa.colorAvatar}`}>
          {empresa.logoIniciales}
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight">{empresa.nombre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {empresa.ruc && <span>RUC {empresa.ruc}</span>}
            {empresa.canalesVenta.length > 0 && (
              <>
                <span>·</span>
                <span>{empresa.canalesVenta.join(", ")}</span>
              </>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Impersonación todavía no existe en backend — ver docs/superadmin/empresas-endpoints.md.")}
          >
            <LogIn className="h-3.5 w-3.5" />
            Entrar como admin
          </Button>
        </div>
      </div>
    </div>
  );
}
