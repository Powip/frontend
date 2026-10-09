import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { WhatsAppResourceState } from "./WhatsAppResourceState";

const meta = {
  title: "WhatsApp/WhatsAppResourceState",
  component: WhatsAppResourceState<string[]>,
  parameters: { layout: "padded" },
  args: {
    state: { kind: "pending-integration" },
    pendingTitle: "Plantillas · pendiente de integración",
    pendingDescription: "Se mostrarán cuando el servicio de plantillas esté disponible.",
    loadingLabel: "Cargando plantillas",
    errorTitle: "No se pudieron cargar las plantillas",
    onRetry: fn(),
    isEmpty: (data: string[]) => data.length === 0,
    empty: <p className="text-sm text-muted-foreground">Todavía no tienes plantillas.</p>,
    children: (data: string[]) => (
      <ul className="list-disc pl-5 text-sm">
        {data.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ),
  },
} satisfies Meta<typeof WhatsAppResourceState<string[]>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};

export const Loading: Story = { args: { state: { kind: "loading" } } };

export const Forbidden: Story = { args: { state: { kind: "forbidden" } } };

export const ErrorWithRetry: Story = {
  args: { state: { kind: "error", message: "El servicio respondió con un error (503)." } },
};

export const Empty: Story = { args: { state: { kind: "ready", data: [] } } };

export const Ready: Story = {
  args: { state: { kind: "ready", data: ["guia_creada", "pedido_en_camino"] } },
};
