import type { Metadata } from "next";
import "./../src/styles/globals.css";
import { Sidebar } from "@/src/components/layout/Sidebar";
import Providers from "@/src/contexts/Providers";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

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

            <main className="flex-1 bg-gray-light">
              {children}
            </main>
          </div>
          <ReactQueryDevtools initialIsOpen={false} />
        </Providers>
      </body>
    </html>
  );
}