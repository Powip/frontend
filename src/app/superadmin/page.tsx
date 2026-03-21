"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperadmin } from "@/config/permissions.config";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Search,
  X,
  Info,
  ExternalLink,
  RefreshCw,
  Check,
  Plus,
  Edit,
  User,
  BarChart3,
  AlertOctagon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
}
from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SellerStats } from "@/components/dashboard/seller-stats";
import { useLeads } from "@/hooks/useLeads";
import { CrmPipelineView } from "@/components/superadmin/CrmPipelineView";
import { CompaniesView } from "@/components/superadmin/CompaniesView";

import { SaasMetrics } from "@/components/superadmin/SaasMetrics";
import { ChurnAlertsTable } from "@/components/superadmin/ChurnAlertsTable";
import { ChurnRiskView } from "@/components/superadmin/ChurnRiskView";
import { ConversionFunnel } from "@/components/superadmin/ConversionFunnel";
import { UsersView } from "@/components/superadmin/UsersView";
import { InventoryView } from "@/components/superadmin/InventoryView";
import { OverviewView } from "@/components/superadmin/OverviewView";
import { useSaasMetrics, useChurnAlerts } from "@/hooks/useSaasMetrics";
import { useConversionFunnel } from "@/hooks/useConversionFunnel";
import { Pagination } from "@/components/ui/pagination";


import {
  getProductSummary,
  getOutOfStockSummary,
  getOutOfStockDetails,
  getCompanyProductCount,
  OutOfStockItem,
} from "@/services/productService";
import {
  getGlobalSalesSummary,
  getGlobalBilling,
  getCompanySalesSummary,
  getCompanyBilling,
  BillingStats,
} from "@/services/salesService";
import {
  getExpiringSubscriptionsAlert,
  getSubscriptionByUserId,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  getAllPlans,
  refreshUserSubscription,
  Plan,
  SubscriptionDetail,
} from "@/services/subscriptionService";
import {
  createCompanyUser,
  getRoles,
  getUsersByCompany,
  createPlatformUser,
  updateUser,
  getAllUsers,
  Role,
} from "@/services/userService";

import {
  Company,
  createCompany as createCompanyService,
  getAllCompanies,
} from "@/services/companyService";
import { decodeToken } from "@/lib/jwt";
import StatsChart from "@/components/superadmin/StatsChart";

import { toast } from "sonner";
import ActionButton from "@/components/ui/action-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";

export default function SuperadminPage() {
  const { auth, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Real metrics states
  const [metrics, setMetrics] = useState({
    totalCompanies: 0,
    totalUsers: 0,
    monthlyRevenue: 0,
    totalProducts: 0,
    outOfStockCount: 0,
    totalSales: 0,
    orderCount: 0,
  });

  // State for extended data
  const [outOfStockItems, setOutOfStockItems] = useState<OutOfStockItem[]>([]);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState<
    SubscriptionDetail[]
  >([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [globalBilling, setGlobalBilling] = useState<any[]>([]);

  const [companies, setCompanies] = useState<any[]>([]);

  // Company detail modal states
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [period, setPeriod] = useState<"all" | "weekly" | "monthly" | "yearly">("all");

  const ITEMS_PER_PAGE = 10;
  const [companiesPage, setCompaniesPage] = useState(1);

  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>(
    {},
  );

  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);


  const { data: leads = [], isLoading: isLoadingLeads } = useLeads(auth?.accessToken);
  const { data: saasMetrics, isLoading: isLoadingMetrics } = useSaasMetrics(auth?.accessToken);
  const { data: churnAlerts = [], refetch: refetchAlerts } = useChurnAlerts(auth?.accessToken);
  const { data: funnelData, isLoading: isLoadingFunnel } = useConversionFunnel(auth?.accessToken);

  useEffect(() => {
    if (auth?.accessToken) {
      getAllPlans(auth.accessToken).then(setPlans).catch(console.error);
      getRoles(auth.accessToken).then(setRoles).catch(console.error);
    }
  }, [auth]);
  const calculateDates = useCallback(() => {
    const to = new Date();
    let from = new Date();

    if (period === "all") {
      setDateRange({});
      return;
    }

    switch (period) {
      case "weekly":
        from.setDate(to.getDate() - 7);
        break;
      case "monthly":
        from.setMonth(to.getMonth() - 1);
        break;
      case "yearly":
        from.setFullYear(to.getFullYear() - 1);
        break;
    }

    setDateRange({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
    });
  }, [period]);

  useEffect(() => {
    calculateDates();
  }, [calculateDates]);

  const refreshData = useCallback(async () => {
    if (!auth?.accessToken) return;
    try {
      const token = auth.accessToken;
      const [
        users,
        allCompanies,
        products,
        outOfStock,
        sales,
        outOfStockList,
        expiringAlert,
        globalBillingData,
      ] = await Promise.all([
        getAllUsers(token),
        getAllCompanies(token),
        getProductSummary(token),
        getOutOfStockSummary(token).catch(() => ({ count: 0 })),
        getGlobalSalesSummary(token, dateRange.from, dateRange.to).catch(
          () => ({
            totalSales: 0,
            orderCount: 0,
          }),
        ),
        getOutOfStockDetails(token).catch(() => []),
        getExpiringSubscriptionsAlert(token).catch(() => []),
        getGlobalBilling(token).catch(() => []),
      ]);

      setMetrics({
        totalCompanies: allCompanies.length,
        totalUsers: users.length,
        monthlyRevenue: sales.totalSales,
        totalProducts: products.total,
        outOfStockCount: outOfStock.count,
        totalSales: sales.totalSales,
        orderCount: sales.orderCount,
      });

      setAllUsers(users);
      setGlobalBilling(
        globalBillingData.map((b: any) => ({
          ...b,
          "2025": b.currentYear,
          "2024": b.previousYear,
        })),
      );
      setOutOfStockItems(outOfStockList);
      setExpiringSubscriptions(expiringAlert);

      const enrichedCompanies = await Promise.all(
        allCompanies.map(async (company) => {
          try {
            const subs = await getSubscriptionByUserId(
              token,
              company.userId,
            );
            const activeSub =
              subs.find(
                (s) =>
                  s.status === "ACTIVE" || s.status === "PENDING_PAYMENT",
              ) || subs[0];
            return {
              ...company,
              plan: activeSub?.plan?.name || "N/A",
              price: activeSub?.plan?.price || 0,
              expiry: activeSub?.endDate || "N/A",
              status: activeSub?.status || "ACTIVE",
            };
          } catch {
            return {
              ...company,
              plan: "N/A",
              price: 0,
              expiry: "N/A",
              status: "ACTIVE",
            };
          }
        }),
      );

      setCompanies(enrichedCompanies);
    } catch (error) {
      console.error("Error refreshing superadmin data:", error);
    }
  }, [auth?.accessToken, dateRange.from, dateRange.to]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && mounted && auth?.accessToken) {
      if (!isSuperadmin(auth?.user.email)) {
        router.push("/");
        return;
      }
      refreshData();
    }
  }, [auth, loading, mounted, router, refreshData]);

  const handleCompanyClick = async (company: Company) => {
    setSelectedCompany(company);
    setIsCompanyModalOpen(true);
  };

  if (loading || !mounted)
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Cargando seguridad...
      </div>
    );

  if (!isSuperadmin(auth?.user.email)) return null;

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            Panel de Superadmin
          </h1>
        </div>
        <p className="text-muted-foreground">
          Bienvenido. Aquí puedes monitorear el estado global del sistema Powip.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => setIsCreateCompanyOpen(true)} className="gap-2">
          <Building2 className="h-4 w-4" />
          Nueva Compañía
        </Button>
        <Button
          onClick={() => setIsCreateUserOpen(true)}
          variant="outline"
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="weekly">Última semana</SelectItem>
              <SelectItem value="monthly">Último mes</SelectItem>
              <SelectItem value="yearly">Último año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 h-auto p-1 bg-muted/50 border">
          <TabsTrigger value="overview" className="gap-2 py-2">
            <TrendingUp className="h-4 w-4" />
            Vista General
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2 py-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 py-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2 py-2">
            <AlertTriangle className="h-4 w-4" />
            Almacén
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2 py-2">
            <Users className="h-4 w-4" />
            CRM Leads
          </TabsTrigger>
          <TabsTrigger value="churn-risk" className="gap-2 py-2">
            <AlertOctagon className="h-4 w-4 text-red-500" />
            Riesgo de Churn
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2 py-2">
            <ShieldCheck className="h-4 w-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewView
            metrics={metrics}
            saasMetrics={saasMetrics}
            isLoadingMetrics={isLoadingMetrics}
            funnelData={funnelData}
            isLoadingFunnel={isLoadingFunnel}
            globalBilling={globalBilling}
            refetchAlerts={refetchAlerts}
          />
        </TabsContent>

        <TabsContent value="churn-risk" className="space-y-6">
          <ChurnRiskView 
            alerts={churnAlerts.map((a: any) => {
              const company = companies.find(c => c.id === a.business_id);
              return { 
                ...a, 
                company: company ? { name: company.name, plan: company.plan, price: company.price } : a.company 
              };
            })}
            metrics={saasMetrics || { churnRate: 0, mrr: 0 }}
            companies={companies}
            onResolve={async (id) => {
              const note = window.prompt("Ingrese una nota de resolución:");
              if (note === null) return;
              try {
                const config = auth?.accessToken ? { headers: { Authorization: `Bearer ${auth.accessToken}` } } : {};
                await axios.patch(`/api/superadmin/churn-alerts/${id}/resolve`, { note }, config);
                toast.success("Alerta marcada como atendida");
                refetchAlerts();
              } catch (error) {
                toast.error("Error al procesar la resolución");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="companies" className="space-y-4">
          <CompaniesView
            companies={companies}
            auth={auth}
            plans={plans}
            allUsers={allUsers}
            onCreateSuccess={refreshData}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UsersView
            allUsers={allUsers}
            auth={auth}
            roles={roles}
            companies={companies}
            plans={plans}
            onUpdateSuccess={refreshData}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <InventoryView
            outOfStockItems={outOfStockItems}
            metrics={metrics}
            companies={companies}
          />
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <CrmPipelineView
            leads={leads}
            token={auth?.accessToken}
            isLoading={isLoadingLeads}
          />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">ms-auth</span>
                  <Badge className="bg-green-500">ONLINE</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  v1.2.4 - Respondido en 45ms
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">ms-ventas</span>
                  <Badge className="bg-green-500">ONLINE</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  v2.1.0 - Respondido en 112ms
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">ms-subscription</span>
                  <Badge className="bg-amber-500">LAGGING</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Reintentando conexión con Mercado Pago...
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <CompanyDetailModal
        isOpen={isCompanyModalOpen}
        onOpenChange={setIsCompanyModalOpen}
        company={selectedCompany}
        plans={plans}
        auth={auth}
      />

      <CreateCompanyModal
        isOpen={isCreateCompanyOpen}
        onOpenChange={setIsCreateCompanyOpen}
        auth={auth}
        allUsers={allUsers}
        onSaveSuccess={refreshData}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  status,
  tooltip,
}: any) {
  return (
    <Card className="relative overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {tooltip && (
            <span title={tooltip} className="cursor-help">
              <Info className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
            </span>
          )}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 text-balance">
          {description}
          {trend && (
            <span className="text-green-600 ml-1 font-medium">{trend}</span>
          )}
        </p>
      </CardContent>
      {status === "success" && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-green-500/50" />
      )}
      {status === "warning" && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-amber-500/50" />
      )}
    </Card>
  );
}

function HelpTooltip({ text }: { text: string }) {
  return (
    <span title={text} className="cursor-help inline-flex ml-1">
      <Info className="h-3 w-3 text-muted-foreground" />
    </span>
  );
}

function CompanyDetailModal({
  isOpen,
  onOpenChange,
  company,
  auth,
  plans,
}: any) {
  const [details, setDetails] = useState<any>({
    users: [],
    productCount: 0,
    sales: { totalSales: 0, orderCount: 0 },
    billing: [],
    loading: true,
  });
  const [period, setPeriod] = useState("all");

  const fetchDetails = async () => {
    if (!company || !auth?.accessToken) return;
    setDetails((prev: any) => ({ ...prev, loading: true }));
    try {
      const token = auth.accessToken;
      // Calculate dates
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      let from: string | undefined;
      switch (period) {
        case "weekly":
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
          break;
        case "monthly":
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
          break;
        case "yearly":
          from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
          break;
      }

      const [users, productCount, sales, billing] = await Promise.all([
        getUsersByCompany(company.id, token).catch(() => []),
        getCompanyProductCount(token, company.id).catch(() => 0),
        getCompanySalesSummary(
          token,
          company.id,
          from,
          from ? today : undefined,
        ).catch(() => ({
          totalSales: 0,
          orderCount: 0,
        })),
        getCompanyBilling(token, company.id).catch(() => []),
      ]);

      setDetails({
        users,
        productCount,
        sales,
        billing: billing.map((b: any) => ({
          ...b,
          "2025": b.ordersCount, // Simplificado para el gráfico
          "2024": b.previousOrdersCount,
        })),
        loading: false,
      });
    } catch (err) {
      console.error(err);
      setDetails((prev: any) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (isOpen) fetchDetails();
  }, [isOpen, company, period]);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="h-6 w-6 text-primary" />
            Detalle de Compañía: {company?.name}
          </DialogTitle>
          <DialogDescription>
            Información consolidada de la organización en la plataforma.
          </DialogDescription>
        </DialogHeader>

        {details.loading ? (
          <div className="py-20 text-center animate-pulse text-muted-foreground whitespace-pre-wrap">
            Cargando estadísticas de {company?.name}...
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="flex justify-end">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el tiempo</SelectItem>
                  <SelectItem value="weekly">Última semana</SelectItem>
                  <SelectItem value="monthly">Último mes</SelectItem>
                  <SelectItem value="yearly">Último año</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Quick Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground">
                    Productos Totales
                  </div>
                  <div className="text-2xl font-bold">
                    {details.productCount}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground">
                    Órdenes Realizadas
                  </div>
                  <div className="text-2xl font-bold">
                    {details.sales.orderCount}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground">
                    Facturación Acumulada
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    S/ {details.sales.totalSales.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart */}
            <StatsChart
              title="Comparativa de Órdenes Mensuales (Año Actual vs Previo)"
              data={details.billing}
              xKey="month"
              lines={[
                { key: "2025", name: "Año Actual", color: "var(--primary)" },
                { key: "2024", name: "Año Previo", color: "#94a3b8" },
              ]}
            />

            {/* Subscription Section */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Suscripción Actual
                </h3>
                <Badge
                  variant={
                    company?.status === "ACTIVE" ? "default" : "destructive"
                  }
                >
                  {company?.status || "N/A"}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plan Vigente</p>
                  <p className="text-lg font-bold">{company?.plan || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Vencimiento</p>
                  <p className="text-lg font-bold text-amber-600">
                    {company?.expiry || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={async (planId) => {
                      if (!company || !auth?.accessToken) return;
                      try {
                        // Buscar la sub activa
                        const subs = await getSubscriptionByUserId(
                          auth.accessToken,
                          company.userId,
                        );
                        const activeSub =
                          subs.find((s) => s.status === "ACTIVE") || subs[0];

                        if (activeSub) {
                          await updateSubscription(
                            auth.accessToken,
                            activeSub.id,
                            { planId },
                          );
                          toast.success("Suscripción actualizada");
                        } else {
                          await createSubscription(auth.accessToken, {
                            userId: company.userId,
                            planId,
                          });
                          toast.success("Suscripción creada");
                        }
                      } catch (err) {
                        toast.error("Error al actualizar suscripción");
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Cambiar Plan / Upgrade" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p: Plan) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - S/ {p.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="text-red-500">
                  Cancelar Suscripción
                </Button>
              </div>
            </div>

            {/* Users Section */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Equipo ({details.users.length})
              </h3>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.name} {u.surname}
                        </TableCell>
                        <TableCell className="text-xs">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {u.role?.name || "User"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-500/10 text-green-600 border-green-200">
                            Activo
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {details.users.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-4 text-muted-foreground"
                        >
                          No se encontraron usuarios vinculados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ACTIVE":
      return (
        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200">
          Activo
        </Badge>
      );
    case "EXPIRING_SOON":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200">
          Por vencer
        </Badge>
      );
    case "EXPIRED":
      return (
        <Badge
          variant="destructive"
          className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200"
        >
          Vencido
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function CreateCompanyModal({ isOpen, onOpenChange, auth, allUsers, onSaveSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    ownerEmail: "",
    cuit: "",
    billingAddress: "",
    phone: "",
    billingEmail: "",
  });

  const handleSave = async () => {
    if (!auth?.accessToken) return;

    // Resolve email to userId
    const owner = allUsers.find(
      (u: any) => u.email.toLowerCase() === formData.ownerEmail.toLowerCase(),
    );

    if (!owner) {
      toast.error("No se encontró un usuario con ese email");
      return;
    }

    setLoading(true);
    try {
      await createCompanyService(auth.accessToken, {
        ...formData,
        userId: owner.id,
        billingEmail: formData.billingEmail || formData.ownerEmail,
      });
      toast.success("Compañía creada con éxito");
      onOpenChange(false);
      onSaveSuccess?.();
    } catch (error) {
      toast.error("Error al crear compañía");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Compañía</DialogTitle>
          <DialogDescription>
            Registra una nueva empresa en la plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nombre de la Empresa</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej: Mi Negocio S.A.C."
            />
          </div>
          <div className="space-y-2">
            <Label>Email del Usuario Dueño</Label>
            <Input
              value={formData.ownerEmail}
              onChange={(e) =>
                setFormData({ ...formData, ownerEmail: e.target.value })
              }
              placeholder="email@ejemplo.com"
            />
          </div>
          <div className="space-y-2">
            <Label>RUC / CUIT</Label>
            <Input
              value={formData.cuit}
              onChange={(e) =>
                setFormData({ ...formData, cuit: e.target.value })
              }
              placeholder="11 dígitos"
            />
          </div>
          <div className="space-y-2">
            <Label>Dirección Fiscal</Label>
            <Input
              value={formData.billingAddress}
              onChange={(e) =>
                setFormData({ ...formData, billingAddress: e.target.value })
              }
              placeholder="Av. Principal 123..."
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+51 987654321"
            />
          </div>
          <div className="space-y-2">
            <Label>Email de Facturación</Label>
            <Input
              value={formData.billingEmail || formData.ownerEmail}
              onChange={(e) =>
                setFormData({ ...formData, billingEmail: e.target.value })
              }
              placeholder="facturacion@empresa.com"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <ActionButton
            label="Crear Compañía"
            loadingLabel="Guardando..."
            onClick={handleSave}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
