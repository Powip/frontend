"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";

export default function AppContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const noSidebarRoutes = ["/login", "/restablecer-contraseña", "/new-company"];

  const hideSidebar = noSidebarRoutes.some((r) => pathname.startsWith(r));

  return (
    <div className="flex h-screen overflow-hidden">
      {!hideSidebar && <Sidebar />}
      <main className="flex-1 bg-gray-light overflow-auto">{children}</main>
    </div>
  );
}
