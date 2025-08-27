import type { Metadata } from "next";
import "./../src/styles/globals.css";
import { Sidebar } from "@/src/components/layout/Sidebar";

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
        <div className="flex min-h-screen">
          <Sidebar />

          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}