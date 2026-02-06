import type { Metadata } from "next";
import "../styles/globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AppContainer from "@/components/layout/AppContainer";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import QueryProvider from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: "Powip",
  description: "Gestión de ventas para negocios digitales",
  keywords: [
    "ERP",
    "WhatsApp",
    "Instagram",
    "TikTok",
    "ventas",
    "pedidos",
    "inventario",
    "cobranzas",
  ],
  openGraph: {
    title: "POWIP - Gestión de ventas para negocios digitales",
    description:
      "Centraliza tus pedidos, gestiona tu inventario y haz seguimiento a tus cobranzas.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <AppContainer>{children}</AppContainer>
              <Toaster position="top-right" richColors />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
