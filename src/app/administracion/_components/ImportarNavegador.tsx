"use client";

/**
 * FEAT-34 Fase 3: aviso para subir una vez lo que Administración guardaba en este navegador (metas, objetivos por
 * canal, capital y cuentas). Solo aparece si el navegador tiene datos de la empresa de la sesión. Después de subir, la
 * copia local pasa a `powip:admin:respaldo:*` (no se borra) y el aviso no vuelve.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { importarDatosLocales } from "@/api/Administracion";
import { useAuth } from "@/contexts/AuthContext";
import type { ImportacionLocal, TipoImportacion } from "@/interfaces/IAdministracion";
import { mensajeError } from "../_lib/datosServidor";
import { armarImportacion, guardarRespaldoLocal, type ImportacionArmada } from "../_lib/importarNavegador";
import { Aviso, claseBotonPrimario } from "./ui";

const NOMBRES: Record<TipoImportacion, [string, string]> = {
  metas: ["año de metas", "años de metas"],
  objetivos: ["objetivo diario", "objetivos diarios"],
  capital: ["registro de capital", "registros de capital"],
  cuentas: ["cuenta", "cuentas"],
};
const ORDEN: TipoImportacion[] = ["metas", "objetivos", "capital", "cuentas"];

function detalle(cuantos: Partial<Record<TipoImportacion, number>>): string {
  return ORDEN.filter((t) => (cuantos[t] ?? 0) > 0)
    .map((t) => {
      const n = cuantos[t] ?? 0;
      return `${n} ${NOMBRES[t][n === 1 ? 0 : 1]}`;
    })
    .join(" · ");
}

const contar = (datos: Required<ImportacionLocal>) => ({
  metas: datos.metas.length,
  objetivos: datos.objetivos.length,
  capital: datos.capital.length,
  cuentas: datos.cuentas.length,
});

function leerNavegador(companyId: string): ImportacionArmada | null {
  try {
    const armada = armarImportacion(window.localStorage, companyId);
    return armada.hayDatos ? armada : null;
  } catch {
    return null; // Navegador sin acceso a localStorage: no hay nada que ofrecer.
  }
}

export function ImportarNavegador() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const qc = useQueryClient();
  // Se lee después de montar: en el servidor no hay localStorage.
  const [pendiente, setPendiente] = useState<ImportacionArmada | null>(null);
  useEffect(() => {
    setPendiente(companyId && auth?.accessToken ? leerNavegador(companyId) : null);
  }, [companyId, auth?.accessToken]);

  const subir = useMutation({
    mutationFn: (armada: ImportacionArmada) => importarDatosLocales(armada.datos),
    onSuccess: (resumen, armada) => {
      try {
        guardarRespaldoLocal(window.localStorage, armada.claves);
      } catch {
        // Sin acceso al navegador: el servidor ya tiene los datos; el aviso se ofrecería otra vez y no duplica nada.
      }
      setPendiente(null);
      for (const clave of ["admin-metas", "admin-objetivos", "admin-capital", "admin-cuentas"]) {
        void qc.invalidateQueries({ queryKey: [clave] });
      }
      const subido = detalle(resumen.importado);
      if (subido) toast.success(`Subido: ${subido}. Ya lo ve todo el equipo.`);
      if (resumen.omitido.length) {
        const tipos = resumen.omitido.map((t) => NOMBRES[t][1]).join(", ");
        toast.info(
          `No se subieron ${tipos}: el servidor ya tenía datos de ese tipo cargados por otra persona. La copia de este navegador queda como respaldo.`,
        );
      }
    },
    onError: (error) => toast.error(mensajeError(error, "No se pudieron subir los datos. Prueba de nuevo.")),
  });

  if (!pendiente) return null;

  return (
    <Aviso tono="info" className="mb-4" titulo="Tienes datos de Administración guardados solo en este navegador">
      <p>
        {detalle(contar(pendiente.datos))}. Antes estos datos vivían en cada computadora; ahora se guardan en el
        servidor y los ve todo el equipo. Súbelos una vez para no perderlos (lo que el servidor ya tenga no se pisa).
      </p>
      <button
        type="button"
        className={`${claseBotonPrimario} mt-2`}
        disabled={subir.isPending}
        onClick={() => subir.mutate(pendiente)}
      >
        <Upload className="h-3.5 w-3.5" aria-hidden />
        {subir.isPending ? "Subiendo…" : "Subirlos al servidor"}
      </button>
    </Aviso>
  );
}
