import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdvertisingDashboard } from "./AdvertisingDashboard";
import { AdvertisingPreview } from "./AdvertisingPreview";
import { EMPTY_ADVERTISING_SNAPSHOT } from "./advertising-model";

const meta = {
  title: "Powip/Administración/Inversión publicitaria",
  component: AdvertisingPreview,
  parameters: { layout: "fullscreen" },
  argTypes: {
    scenario: {
      control: "select",
      options: [
        "complete",
        "partial",
        "disconnected",
        "reconnect",
        "currencies",
        "zero",
        "no-orders",
      ],
    },
  },
  args: { scenario: "complete" },
} satisfies Meta<typeof AdvertisingPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inversion: Story = {};
export const DatosParciales: Story = { args: { scenario: "partial" } };
export const SinConexion: Story = { args: { scenario: "disconnected" } };
export const Reconectar: Story = { args: { scenario: "reconnect" } };
export const VariasMonedas: Story = { args: { scenario: "currencies" } };
export const CeroConfirmado: Story = { args: { scenario: "zero" } };
export const DiaSinPedidos: Story = { args: { scenario: "no-orders" } };
export const EstadoActual: Story = {
  render: () => (
    <AdvertisingDashboard
      companyName="Mi empresa"
      from="2026-10-01"
      to="2026-10-08"
      snapshot={EMPTY_ADVERTISING_SNAPSHOT}
    />
  ),
};
