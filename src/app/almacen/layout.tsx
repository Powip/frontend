import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import WarehouseShell from "@/components/almacen/WarehouseShell";

// FEAT-24 H6-D (H6-D1) — modo almacén: PWA dentro del mismo frontend, con su
// manifiesto (se instala como «Almacén» y abre en /almacen) y un layout móvil
// propio, sin el sidebar de POWIP.

export const metadata: Metadata = {
  title: "Powip Almacén",
  description: "Consultar stock, recibir devoluciones y hacer picking desde el celular.",
  manifest: "/almacen/manifest.webmanifest",
  applicationName: "Powip Almacén",
  appleWebApp: { capable: true, title: "Almacén", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/almacen/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/almacen/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/almacen/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a647c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AlmacenLayout({ children }: { children: ReactNode }) {
  return <WarehouseShell>{children}</WarehouseShell>;
}
