"use client";

import { use, useState } from "react";
import { useEmpresaDetail } from "@/hooks/superadmin/useEmpresas";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerfilHeader } from "@/components/superadmin/empresas/perfil360/PerfilHeader";
import { SaludTab } from "@/components/superadmin/empresas/perfil360/SaludTab";
import { VentasTab } from "@/components/superadmin/empresas/perfil360/VentasTab";
import { PedidosTab } from "@/components/superadmin/empresas/perfil360/PedidosTab";
import { ProductosTab } from "@/components/superadmin/empresas/perfil360/ProductosTab";
import { FacturacionTab } from "@/components/superadmin/empresas/perfil360/FacturacionTab";
import { PagosTab, EnviosTab } from "@/components/superadmin/empresas/perfil360/PagosEnviosTab";
import { IntegracionesTab } from "@/components/superadmin/empresas/perfil360/IntegracionesTab";
import { SuscripcionTab, UsuariosTab, SoporteTab } from "@/components/superadmin/empresas/perfil360/SuscripcionUsuariosSoporteTab";
import { getHealthFactores } from "@/mocks/superadmin";
import { TableSkeleton } from "@/components/superadmin/shared";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

const TABS = [
  ["salud", "Salud"],
  ["ventas", "Ventas & GMV"],
  ["pedidos", "Pedidos"],
  ["productos", "Productos & SKUs"],
  ["facturacion", "Facturación"],
  ["pagos", "Pagos & Recaudos"],
  ["envios", "Envíos & Couriers"],
  ["integraciones", "Integraciones & Upsell"],
  ["suscripcion", "Suscripción"],
  ["usuarios", "Usuarios"],
  ["soporte", "Soporte"],
] as const;

export default function PerfilEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { empresa, raw, isLoading } = useEmpresaDetail(id);
  const [tab, setTab] = useState<string>("salud");

  if (isLoading) return <TableSkeleton rows={10} cols={4} />;

  if (!empresa) {
    return <EmptyState icon={Building2} title="Empresa no encontrada" description="Revisa el enlace o vuelve al directorio de empresas." />;
  }

  return (
    <div>
      <PerfilHeader empresa={empresa} />

      {/* Cada tab renderiza (y por lo tanto pide sus datos) solo cuando está activo — con 11 tabs y varios
          reales, montar todos a la vez dispararía ~10 requests innecesarios en cada carga del perfil. */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
          {TABS.map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "salud" && <SaludTab empresa={empresa} health={getHealthFactores(empresa)} />}
      {tab === "ventas" && <VentasTab empresaId={id} />}
      {tab === "pedidos" && <PedidosTab empresaId={id} />}
      {tab === "productos" && <ProductosTab empresaId={id} />}
      {tab === "facturacion" && <FacturacionTab empresaId={id} empresa={empresa} />}
      {tab === "pagos" && <PagosTab empresa={empresa} />}
      {tab === "envios" && <EnviosTab empresaId={id} />}
      {tab === "integraciones" && <IntegracionesTab empresaId={id} empresa={empresa} />}
      {tab === "suscripcion" && <SuscripcionTab empresa={empresa} userId={raw?.userId ?? null} />}
      {tab === "usuarios" && <UsuariosTab empresaId={id} />}
      {tab === "soporte" && <SoporteTab empresa={empresa} />}
    </div>
  );
}
