import { PANEL_ROLE_POLICIES } from "../../config/panel-roles.config";
import { PANEL_CONTRACT_IDS, type PanelContractId } from "../../models/panel-contract.model";
import type { PanelCapability, PanelRole } from "../../models/panel-role.model";
import { CATALOGO, contexto, MES, NOW } from "../demo/__tests__/demo-contexto";
import { obtenerUniversoDemo } from "../demo/demo-universe";
import { rolPuedeUsarContrato } from "../panel-autorizacion";
import { PANEL_CONTRACTS } from "../panel-contracts";
import type { PanelSource, PanelSourceContext } from "../panel-source";
import { DEFAULT_PANEL_SOURCES } from "../panel-sources";

const CAMPOS_SENSIBLES = new Set([
  "costoUnitario",
  "costoProducto",
  "costoCanal",
  "costoRechazos",
  "margen",
  "ganancia",
  "gananciaSobreEntregado",
  "gane",
  "costos",
  "comision",
  "comisiones",
  "comisionEstimada",
  "comisionesPlataformas",
  "comisionADescontar",
  "netoARecibir",
  "reglaComision",
  "pasarela",
  "flete",
  "fleteTotal",
  "fletePromedio",
  "valorAlCosto",
]);

const CONTRATOS_REALES: PanelContractId[] = ["canales-fichas", "opciones-asesores"];

function camposSensibles(valor: unknown, ruta = ""): string[] {
  if (Array.isArray(valor))
    return valor.flatMap((item, index) => camposSensibles(item, `${ruta}[${index}]`));
  if (!valor || typeof valor !== "object") return [];
  return Object.entries(valor as Record<string, unknown>).flatMap(([clave, hijo]) => {
    const aqui = `${ruta}.${clave}`;
    if (ruta.includes(".metas")) return [];
    const esSensible =
      CAMPOS_SENSIBLES.has(clave) ||
      (clave === "valor" && ruta.includes(".productos")) ||
      clave === "comisionPct" ||
      clave === "pasarelaPct";
    return [...(esSensible ? [aqui] : []), ...camposSensibles(hijo, aqui)];
  });
}

function consultas(id: PanelContractId): object[] {
  const universo = obtenerUniversoDemo(CATALOGO, NOW);
  switch (id) {
    case "canales-comparativo":
      return ["ventas", "entregas", "ganancia"].map((vista) => ({ ...MES, vista }));
    case "canales-detalle":
      return universo.canales.map((canal) => ({ ...MES, canal_id: canal.id }));
    case "equipo-vendedoras":
      return [{ ...MES, agrupar: "asesora", upsell: "con" }];
    case "config-metas":
      return [{ empresaId: "e1" }];
    case "exportacion-libro":
      return [{ ...MES, formato: "xlsx" }];
    case "detalle":
      return ["ventas", "entregados", "leads"].map((grupo) => ({
        ...MES,
        grupo,
        grupo_params: "{}",
        pagina: 1,
        tamano_pagina: 50,
      }));
    default:
      return [MES];
  }
}

const CONTRATOS_CON_ESCRITURA: PanelContractId[] = [
  "canales-fichas-guardar",
  "config-metas-guardar",
  "acciones-pedido",
];

const ROLES: [PanelRole, string | null][] = [
  ["supervisora", null],
  ["confirmadora", "a1"],
  ["vendedora", "a1"],
];

describe("permisos: ningún rol sin permiso recibe costos, margen, ganancia ni comisiones", () => {
  for (const [role, asesor] of ROLES) {
    it(`${role}: cada contrato responde 403 o sin campos sensibles`, async () => {
      const ctx: PanelSourceContext = contexto(role, asesor);
      for (const id of PANEL_CONTRACT_IDS) {
        if (CONTRATOS_REALES.includes(id) || CONTRATOS_CON_ESCRITURA.includes(id)) continue;
        const source = DEFAULT_PANEL_SOURCES[id] as PanelSource<PanelContractId> | undefined;
        if (!source) continue;
        const permitido = rolPuedeUsarContrato(id, role, ctx.capabilities);
        for (const query of consultas(id)) {
          const intento = source.fetch(query as never, ctx);
          if (!permitido) {
            await expect(intento).rejects.toThrow("403");
            continue;
          }
          let respuesta: unknown;
          try {
            respuesta = await intento;
          } catch (error) {
            expect(String(error)).toMatch("403");
            continue;
          }
          expect({ id, campos: camposSensibles(respuesta) }).toEqual({ id, campos: [] });
        }
      }
    });
  }

  for (const role of ["confirmadora", "vendedora"] as const) {
    it(`${role}: ninguna respuesta trae metas mensuales de otras personas`, async () => {
      const ctx: PanelSourceContext = contexto(role, "a1");
      const ajenas: string[] = [];
      const revisar = (valor: unknown, ruta: string) => {
        if (!valor || typeof valor !== "object") return;
        for (const [clave, hijo] of Object.entries(valor as Record<string, unknown>)) {
          if ((clave === "porVendedora" || clave === "porConfirmadora") && hijo) {
            for (const id of Object.keys(hijo))
              if (id !== "a1") ajenas.push(`${ruta}.${clave}.${id}`);
          } else revisar(hijo, `${ruta}.${clave}`);
        }
      };
      for (const id of PANEL_CONTRACT_IDS) {
        if (CONTRATOS_REALES.includes(id) || CONTRATOS_CON_ESCRITURA.includes(id)) continue;
        const source = DEFAULT_PANEL_SOURCES[id] as PanelSource<PanelContractId> | undefined;
        if (!source || !rolPuedeUsarContrato(id, role, ctx.capabilities)) continue;
        for (const query of consultas(id)) {
          const respuesta = await source.fetch(query as never, ctx).catch(() => null);
          revisar(respuesta, id);
        }
      }
      expect(ajenas).toEqual([]);
    });
  }

  it("las listas de roles de cada contrato respetan §9", () => {
    const soloDueno: PanelContractId[] = [
      "finanzas-resultado",
      "finanzas-caja",
      "finanzas-cobranza",
      "config-estados",
      "config-cuadres",
      "config-metas-guardar",
      "canales-fichas-guardar",
    ];
    for (const id of soloDueno) expect(PANEL_CONTRACTS[id].roles).toEqual(["dueno"]);
    for (const role of ["confirmadora", "vendedora"] as const) {
      const capacidades = new Set<PanelCapability>(PANEL_ROLE_POLICIES[role].capacidades);
      expect(rolPuedeUsarContrato("exportacion-libro", role, capacidades)).toBe(false);
      expect(rolPuedeUsarContrato("compartir-reporte", role, capacidades)).toBe(false);
      expect(rolPuedeUsarContrato("resumen", role, capacidades)).toBe(false);
      expect(rolPuedeUsarContrato("detalle", role, capacidades)).toBe(true);
    }
  });
});
