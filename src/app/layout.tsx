import type { Metadata } from "next";
import "../styles/globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import AppContainer from "@/components/layout/AppContainer";

export const metadata: Metadata = {
  title: "Powip Frontend",
  description: "Frontend básico para Powip",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <AppContainer>{children}</AppContainer>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
