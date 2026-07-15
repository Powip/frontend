"use client";

/**
 * Estado local (no persistido) para los módulos de Facturación SUNAT que aún
 * no tienen backend en ms-integrations: Guías de Remisión, Notas de
 * Crédito/Débito, Certificado Digital y Series y Correlativos.
 *
 * Todo lo que gestiona este hook vive solo en memoria del navegador y se
 * pierde al recargar la página — por eso cada pestaña que lo consume muestra
 * un aviso "Beta" explicando que todavía no está conectado a SUNAT.
 *
 * TODO(integraciones): reemplazar por llamadas reales cuando ms-integrations
 * exponga endpoints de guías, notas y certificado.
 */

import { useCallback, useState } from "react";
import {
  Almacen,
  Certificado,
  ERRORES_GRE,
  Guia,
  Nota,
  Serie,
} from "@/types/facturacion";

const SEED_SERIES: Serie[] = [
  { serie: "B001", tipo: "Boleta electrónica (03)", ultimo: 0, activa: true },
  { serie: "F001", tipo: "Factura electrónica (01)", ultimo: 0, activa: true },
  { serie: "BC01", tipo: "Nota de crédito sobre boletas (07)", ultimo: 0, activa: true },
  { serie: "FC01", tipo: "Nota de crédito sobre facturas (07)", ultimo: 0, activa: true },
  { serie: "BD01", tipo: "Nota de débito sobre boletas (08)", ultimo: 0, activa: false },
  { serie: "FD01", tipo: "Nota de débito sobre facturas (08)", ultimo: 0, activa: false },
  { serie: "T001", tipo: "Guía de remisión remitente electrónica (09)", ultimo: 0, activa: true },
];

export const ALMACENES: Almacen[] = [
  { id: "alm1", nombre: "Almacén Central", tienda: "Tienda principal", direccion: "Av. Argentina 2145, Cercado de Lima" },
  { id: "alm2", nombre: "Almacén Secundario", tienda: "Tienda principal", direccion: "Jr. Puno 890, La Victoria, Lima" },
];

const SEED_CERT: Certificado = {
  configurado: true,
  razon: "",
  ruc: "",
  desde: "",
  hasta: "",
  diasParaVencer: 999,
};

export function useFacturacionMock() {
  const [series, setSeries] = useState<Serie[]>(SEED_SERIES);
  const [guias, setGuias] = useState<Guia[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [cert, setCert] = useState<Certificado>(SEED_CERT);

  const toggleSerie = useCallback((serieCode: string) => {
    setSeries((prev) =>
      prev.map((s) => (s.serie === serieCode ? { ...s, activa: !s.activa } : s))
    );
  }, []);

  const bumpSerie = useCallback((serieCode: string) => {
    let fullNumber = "";
    setSeries((prev) =>
      prev.map((s) => {
        if (s.serie !== serieCode) return s;
        const ultimo = s.ultimo + 1;
        fullNumber = `${s.serie}-${String(ultimo).padStart(8, "0")}`;
        return { ...s, ultimo };
      })
    );
    return fullNumber;
  }, []);

  const emitirGuia = useCallback(
    async (input: Omit<Guia, "id" | "estado" | "fullNumber" | "cdrCode" | "cdrDesc">) => {
      const guia: Guia = {
        ...input,
        id: guias.length ? Math.max(...guias.map((g) => g.id)) + 1 : 1,
        estado: "GENERADA",
      };
      setGuias((prev) => [guia, ...prev]);

      // Simulación de envío a SUNAT (XML -> firma -> envío) solo para feedback visual.
      await new Promise((r) => setTimeout(r, 1500));

      const reject = guia.id % 5 === 0;
      if (!reject) {
        const fullNumber = bumpSerie("T001");
        setGuias((prev) =>
          prev.map((g) => (g.id === guia.id ? { ...g, estado: "ACEPTADA", fullNumber } : g))
        );
        return { ok: true, guia: { ...guia, estado: "ACEPTADA" as const, fullNumber } };
      }
      const err = ERRORES_GRE[1 + (guia.id % (ERRORES_GRE.length - 1))];
      setGuias((prev) =>
        prev.map((g) =>
          g.id === guia.id ? { ...g, estado: "RECHAZADA", cdrCode: err.code, cdrDesc: err.desc } : g
        )
      );
      return { ok: false, guia, error: err };
    },
    [guias, bumpSerie]
  );

  const anularGuia = useCallback((id: number, motivo: string) => {
    setGuias((prev) =>
      prev.map((g) => (g.id === id ? { ...g, estado: "ANULADA", motivoAnulacion: motivo } : g))
    );
  }, []);

  const crearNota = useCallback(
    (input: { original: string; tipoOriginal: "01" | "03"; cliente: string; motivo: string; monto: number }) => {
      const serieKey = input.tipoOriginal === "01" ? "FC01" : "BC01";
      const fullNumber = bumpSerie(serieKey);
      const nota: Nota = {
        fecha: new Date().toLocaleDateString("es-PE"),
        num: fullNumber,
        original: input.original,
        cliente: input.cliente,
        motivo: input.motivo,
        monto: input.monto,
        estado: "ACEPTADO",
      };
      setNotas((prev) => [nota, ...prev]);
      return nota;
    },
    [bumpSerie]
  );

  const subirCertificado = useCallback(async (razon: string, ruc: string) => {
    await new Promise((r) => setTimeout(r, 1400));
    const desde = new Date().toLocaleDateString("es-PE");
    const hasta = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("es-PE");
    setCert({ configurado: true, razon, ruc, desde, hasta, diasParaVencer: 365 });
  }, []);

  return {
    series,
    guias,
    notas,
    cert,
    almacenes: ALMACENES,
    toggleSerie,
    bumpSerie,
    emitirGuia,
    anularGuia,
    crearNota,
    subirCertificado,
  };
}
