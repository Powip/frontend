import type { Metadata } from "next";
import "../styles/globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import Providers from "@/contexts/Providers";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";

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
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />

            <main className="flex-1 bg-gray-light">{children}</main>
            <Toaster position="bottom-center" richColors />
          </div>
          <ReactQueryDevtools initialIsOpen={false} />
        </Providers>
      </body>
    </html>
  );
}
