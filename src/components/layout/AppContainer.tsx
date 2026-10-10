"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { usePathname } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

export default function AppContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { auth } = useAuth();

  const noSidebarRoutes = [
    "/login",
    "/restablecer-contrasena",
    "/new-company",
    "/subscriptions",
    "/rastreo",
    "/onboarding",
  ];

  const hideSidebar = noSidebarRoutes.some((r) => pathname.startsWith(r)) ||
    (!auth && pathname === "/partners/solicitud");

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {!hideSidebar && <Sidebar />}
        <main className="flex-1 bg-gray-light overflow-auto">{children}</main>
      </div>
    </AuthGuard>
  );
}
