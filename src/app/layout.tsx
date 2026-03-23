import type { Metadata } from "next";
import { Montserrat, Poppins } from "next/font/google";
import "../styles/globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
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
    "almacén",
    "cobranzas",
  ],
  openGraph: {
    title: "POWIP - Gestión de ventas para negocios digitales",
    description:
      "Centraliza tus pedidos, gestiona tu almacén y haz seguimiento a tus cobranzas.",
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
      <body suppressHydrationWarning className={`${poppins.variable} ${montserrat.variable} antialiased`}>
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
