"use client";

/**
 * Estado local (no persistido) para los módulos de Facturación SUNAT que aún
 * no tienen backend: Notas de Crédito/Débito (las Guías de Remisión son reales
 * desde FEAT-24 H12, en ms-sunat).
 *
 * Todo lo que gestiona este hook vive solo en memoria del navegador y se
 * pierde al recargar la página — por eso cada pestaña que lo consume muestra
 * un aviso "Beta" explicando que todavía no está conectado a SUNAT.
 *
 * TODO(integraciones): reemplazar por llamadas reales cuando exista el
 * backend de notas.
 */

import { useCallback, useState } from "react";
import { Certificado, Nota, Serie } from "@/types/facturacion";

const SEED_SERIES: Serie[] = [
  { serie: "B001", tipo: "Boleta electrónica (03)", ultimo: 0, activa: true },
  { serie: "F001", tipo: "Factura electrónica (01)", ultimo: 0, activa: true },
  { serie: "BC01", tipo: "Nota de crédito sobre boletas (07)", ultimo: 0, activa: true },
  { serie: "FC01", tipo: "Nota de crédito sobre facturas (07)", ultimo: 0, activa: true },
  { serie: "BD01", tipo: "Nota de débito sobre boletas (08)", ultimo: 0, activa: false },
  { serie: "FD01", tipo: "Nota de débito sobre facturas (08)", ultimo: 0, activa: false },
  { serie: "T001", tipo: "Guía de remisión remitente electrónica (09)", ultimo: 0, activa: true },
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
    notas,
    cert,
    toggleSerie,
    bumpSerie,
    crearNota,
    subirCertificado,
  };
}
