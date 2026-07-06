'use client';
import Header from "@/components/header/Header";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Building2, Store, User, Blocks } from "lucide-react";
import Link from "next/link";

export default function ConfiguracionPage() {
  const { auth, hasPermission } = useAuth();
  const isAdmin =
    hasAdminAccess(auth?.user?.role) ||
    isSuperadmin(auth?.user?.email) ||
    hasPermission("VIEW_FINANCES");

  const configSections = [
    {
      title: "Datos Personales",
      description: "Administra tu información de perfil",
      icon: User,
      href: "/configuracion/editar-usuario",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      adminOnly: false,
    },
    {
      title: "Empresa + Suscripción",
      description: "Información de la empresa y gestión de planes",
      icon: Building2,
      href: "/configuracion/empresa",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      adminOnly: false,
    },
    {
      title: "Gestión de Tiendas",
      description: "Crea y administra tus tiendas",
      icon: Store,
      href: "/configuracion/tiendas",
      color: "text-green-600",
      bgColor: "bg-green-50",
      adminOnly: true,
    },
    {
      title: "Integraciones",
      description: "Conexiones con servicios externos",
      icon: Blocks,
      href: "/configuracion/integraciones",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      adminOnly: false,
    },
  ].filter((s) => !s.adminOnly || isAdmin);

  return (
    <main className="flex-1 p-8">
      <HeaderConfig
        title="Configuración"
        description="Administra los parámetros de tu cuenta y empresa"
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 p-6">
        {configSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-teal-300">
                <CardContent className="p-6">
                  <div
                    className={`${section.bgColor} w-fit rounded-lg p-3 mb-4`}
                  >
                    <Icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {isAdmin && <WhatsAppButton />}
    </main>
  );
}
