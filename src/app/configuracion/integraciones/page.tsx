'use client';
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Link2, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";

export default function IntegracionesHubPage() {
  const integrations = [
    {
      title: "Shalom Courier",
      description: "Integra tu cuenta de Shalom para generar y despachar guías directamente.",
      icon: Truck,
      href: "/configuracion/integraciones/shalom",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      status: "Disponible",
    },
    {
      title: "Shopify (Próximamente unificado)",
      description: "Sincroniza tus órdenes, inventarios y sucursales. La configuración actual reside en Tiendas.",
      icon: ShoppingBag,
      href: "/configuracion/tiendas", // Shortcut until fully migrated
      color: "text-green-600",
      bgColor: "bg-green-50",
      status: "Habilitado en Tiendas",
    },
  ];

  return (
    <main className="flex-1 p-8">
      <HeaderConfig
        title="Centro de Integraciones"
        description="Administra todas las integraciones de terceros disponibles para tu empresa."
      />
      <div className="grid gap-6 md:grid-cols-2 p-6 max-w-5xl mx-auto">
        {integrations.map((integration, idx) => {
          const Icon = integration.icon;
          return (
            <Link key={idx} href={integration.href}>
              <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-indigo-300 relative group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${integration.bgColor} w-fit rounded-lg p-3`}>
                      <Icon className={`h-6 w-6 ${integration.color}`} />
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                      {integration.status}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2">{integration.title}</h3>
                  <p className="text-sm text-gray-600 flex-1">{integration.description}</p>
                  
                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-indigo-600 text-sm font-medium">
                    <span>Configurar</span>
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
