import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toCanalFicha } from "@/features/panel-control/canales/mappers/to-canal-ficha.mapper";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
import { DEFAULT_PANEL_SOURCES } from "@/features/panel-control/shared/data/panel-sources";
import type { PanelRole } from "@/features/panel-control/shared/models/panel-role.model";
import type { PanelSession } from "@/features/panel-control/shared/models/panel-session.model";
import { PanelProvider } from "@/features/panel-control/shared/state/panel-context";
import {
  DEFAULT_PANEL_STATE,
  type PanelUiState,
} from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "./PanelShell";

const NOW = new Date("2026-09-21T21:00:00Z").getTime();

const STORY_SOURCES: PanelSourceRegistry = {
  ...DEFAULT_PANEL_SOURCES,
  detalle: detalleDemoSource,
  "canales-fichas": {
    contractId: "canales-fichas",
    kind: "demo",
    descripcion: "Fichas demo del story (en la app vienen de /config/canales)",
    fetch: async () =>
      [
        "Shopify COD",
        "TikTok Live",
        "WhatsApp",
        "Instagram",
        "Web prepago",
        "Plataforma aliada",
        "Marketplace",
        "Tienda física",
      ].map((nombre, index) => {
        const ficha = toCanalFicha({
          id: `story-canal-${index + 1}`,
          empresaId: "story-empresa",
          canalNombre: nombre.toLowerCase().replace(/\s+/g, "_"),
          canalLabel: nombre,
          flujoEntrada: index < 2 ? "call_center_cod" : "directo_operaciones",
          requiereConfirmacionCc: index < 2,
          activo: true,
          datosRequeridos: [],
        });
        return nombre === "Tienda física" ? { ...ficha, entrada: "presencial" as const } : ficha;
      }),
  },
  "opciones-asesores": {
    contractId: "opciones-asesores",
    kind: "demo",
    descripcion: "Asesoras demo del story",
    fetch: async () => [
      {
        id: "story-confirmadora-1",
        nombre: "Confirmadora demo 1",
        email: null,
        rol: "confirmadora" as const,
      },
      {
        id: "story-confirmadora-2",
        nombre: "Confirmadora demo 2",
        email: null,
        rol: "confirmadora" as const,
      },
      {
        id: "story-confirmadora-3",
        nombre: "Confirmadora demo 3",
        email: null,
        rol: "confirmadora" as const,
      },
      { id: "story-asesora-1", nombre: "Asesora demo 1", email: null, rol: "vendedora" as const },
      { id: "story-asesora-2", nombre: "Asesora demo 2", email: null, rol: "vendedora" as const },
    ],
  },
};

function session(role: PanelRole | null): PanelSession {
  return {
    userId:
      role === "confirmadora"
        ? "story-confirmadora-1"
        : role === "vendedora"
          ? "story-asesora-1"
          : "story-usuario",
    userName:
      role === "confirmadora"
        ? "Confirmadora demo 1"
        : role === "vendedora"
          ? "Asesora demo 1"
          : "Usuario demo",
    empresaId: "story-empresa",
    tiendas: [
      { id: "story-tienda-1", nombre: "Tienda demo 1" },
      { id: "story-tienda-2", nombre: "Tienda demo 2" },
    ],
    rol: role
      ? { status: "resuelto", role, source: "rol_jwt", evidencia: "Story" }
      : {
          status: "sin_resolver",
          rolJwt: "OPERACIONES",
          motivo: "La especificación no define una vista para Operaciones",
        },
  };
}

interface StoryArgs {
  role: PanelRole | null;
  state: PanelUiState;
}

function PanelStory({ role, state }: StoryArgs) {
  return (
    <div className="h-screen overflow-auto">
      <PanelProvider session={session(role)} initialState={state} now={NOW} sources={STORY_SOURCES}>
        <PanelShell />
      </PanelProvider>
    </div>
  );
}

const meta = {
  title: "Panel de Control/Shell",
  component: PanelStory,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  args: { role: "dueno", state: DEFAULT_PANEL_STATE },
} satisfies Meta<typeof PanelStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dueno: Story = {};

export const DuenoConFiltros: Story = {
  args: {
    state: {
      ...DEFAULT_PANEL_STATE,
      filters: {
        ...DEFAULT_PANEL_STATE.filters,
        tiendaId: "story-tienda-1",
        zona: "provincia",
        entrada: "lead",
      },
      navigation: { tab: "operaciones", subtab: "couriers" },
    },
  },
};

export const ConfiguracionCanales: Story = {
  args: {
    state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "configuracion", subtab: "canales" } },
  },
};

export const Supervisora: Story = { args: { role: "supervisora" } };

export const Confirmadora: Story = { args: { role: "confirmadora" } };

export const SoloDatosReales: Story = {
  args: { state: { ...DEFAULT_PANEL_STATE, dataMode: "solo_real" } },
};

export const RolSinResolver: Story = { args: { role: null } };

export const Movil: Story = {
  parameters: { viewport: { defaultViewport: "mobile2" } },
};

export const SupervisoraResumen: Story = {
  args: {
    role: "supervisora",
    state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "resumen", subtab: null } },
  },
};

const ventas = (subtab: "canales" | "productos" | "publicidad" | "clientes"): PanelUiState => ({
  ...DEFAULT_PANEL_STATE,
  navigation: { tab: "canales", subtab },
});

export const VentasCanales: Story = { args: { state: ventas("canales") } };

export const VentasProductos: Story = { args: { state: ventas("productos") } };

export const VentasPublicidad: Story = { args: { state: ventas("publicidad") } };

export const VentasClientes: Story = { args: { state: ventas("clientes") } };

export const SupervisoraVentasCanales: Story = {
  args: { role: "supervisora", state: ventas("canales") },
};

export const VentasSoloReales: Story = {
  args: { state: { ...ventas("canales"), dataMode: "solo_real" } },
};

const navegar = (
  tab: PanelUiState["navigation"]["tab"],
  subtab: PanelUiState["navigation"]["subtab"],
) => ({
  ...DEFAULT_PANEL_STATE,
  navigation: { tab, subtab },
});

export const CallCenter: Story = { args: { state: navegar("callcenter", null) } };

export const ConfirmadoraCallCenter: Story = {
  args: { role: "confirmadora", state: navegar("callcenter", null) },
};

export const OperacionesCola: Story = { args: { state: navegar("operaciones", "cola") } };

export const OperacionesCouriers: Story = { args: { state: navegar("operaciones", "couriers") } };

export const OperacionesInventario: Story = {
  args: { state: navegar("operaciones", "inventario") },
};

export const SupervisoraOperacionesCouriers: Story = {
  args: { role: "supervisora", state: navegar("operaciones", "couriers") },
};

export const FinanzasResultado: Story = { args: { state: navegar("finanzas", "resultado") } };

export const FinanzasCaja: Story = { args: { state: navegar("finanzas", "caja") } };

export const FinanzasCobranza: Story = { args: { state: navegar("finanzas", "cobranza") } };

export const EquipoVendedoras: Story = { args: { state: navegar("equipo", "vendedoras") } };

export const EquipoConfirmadoras: Story = { args: { state: navegar("equipo", "confirmadoras") } };

export const VendedoraMisVentas: Story = {
  args: { role: "vendedora", state: navegar("misventas", null) },
};

export const ConfiguracionMetas: Story = { args: { state: navegar("configuracion", "metas") } };

export const ConfiguracionEstados: Story = { args: { state: navegar("configuracion", "estados") } };

export const ConfiguracionCuadres: Story = { args: { state: navegar("configuracion", "cuadres") } };
