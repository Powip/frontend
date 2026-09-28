import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import type { PanelSession } from "@/features/panel-control/shared/models/panel-session.model";
import { PanelProvider } from "@/features/panel-control/shared/state/panel-context";
import {
  DEFAULT_PANEL_STATE,
  type PanelUiState,
} from "@/features/panel-control/shared/state/panel-state.model";

jest.setTimeout(20_000);
configure({ asyncUtilTimeout: 5_000 });

export const TEST_NOW = new Date("2026-09-21T21:00:00Z").getTime();

export const TEST_SOURCES: PanelSourceRegistry = {
  "canales-fichas": {
    contractId: "canales-fichas",
    kind: "real",
    descripcion: "Fichas de prueba",
    fetch: async () => [
      {
        id: "canal-1",
        nombre: "Canal real 1",
        clave: "canal1",
        familia: null,
        color: null,
        entrada: "lead",
        cobro: null,
        usaCourier: null,
        comisionPct: null,
        pasarelaPct: null,
        recibePautaGeneral: null,
        metaMensual: null,
        activo: true,
        tienePedidos: null,
        reglasPorConfirmar: true,
        camposPendientes: ["cobro"],
      },
    ],
  },
  "opciones-asesores": {
    contractId: "opciones-asesores",
    kind: "real",
    descripcion: "Asesoras de prueba",
    fetch: async () => [{ id: "asesora-1", nombre: "Asesora Uno", email: null }],
  },
  "estado-periodo": {
    contractId: "estado-periodo",
    kind: "demo",
    descripcion: "Estado demo de prueba",
    fetch: async (_query, context) => ({
      actual: {
        pedidosPeriodo: 100,
        pedidosAbiertos: 30,
        porcentajeAbierto: 0.3,
        ...(context.capabilities.has("ver_configuracion")
          ? { calidad: { datosCompletos: 0.9, cuadresOk: 9, cuadresTotal: 9 } }
          : {}),
      },
      anterior_misma_antiguedad: null,
      metas: null,
      generado_en: new Date(TEST_NOW).toISOString(),
    }),
  },
};

export function testSession(role: PanelRole | null): PanelSession {
  return {
    userId: "user-1",
    userName: "Usuaria Prueba",
    empresaId: "empresa-1",
    tiendas: [{ id: "tienda-1", nombre: "Tienda Uno" }],
    rol: role
      ? { status: "resuelto", role, source: "rol_jwt", evidencia: "prueba" }
      : { status: "sin_resolver", rolJwt: "OPERACIONES", motivo: "Sin evidencia" },
  };
}

interface Options {
  role?: PanelRole | null;
  state?: PanelUiState;
  sources?: PanelSourceRegistry;
}

export function renderWithPanel(ui: ReactElement, options: Options = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PanelProvider
        session={testSession(options.role === undefined ? "dueno" : options.role)}
        initialState={options.state ?? DEFAULT_PANEL_STATE}
        now={TEST_NOW}
        sources={options.sources ?? TEST_SOURCES}
      >
        <TooltipProvider>{ui}</TooltipProvider>
      </PanelProvider>
    </QueryClientProvider>,
  );
}
