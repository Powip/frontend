import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { HelpHeaderLink, HelpSection } from "./HelpSection";

/** Sección de ayuda de /configuracion, con el encabezado y su enlace "¿Necesitas ayuda?". */
function HelpSectionPreview() {
  return (
    <div className="bg-background p-4 text-foreground md:p-8">
      <HeaderConfig
        title="Configuración"
        description="Administra los parámetros de tu cuenta y empresa"
      >
        <HelpHeaderLink />
      </HeaderConfig>
      <div className="p-6">
        <HelpSection />
      </div>
    </div>
  );
}

const meta = {
  title: "Configuracion/HelpSection",
  component: HelpSectionPreview,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/configuracion" } },
  },
} satisfies Meta<typeof HelpSectionPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {};

export const Dark: Story = {
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};
