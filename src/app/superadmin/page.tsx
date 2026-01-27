"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SellerStats } from "@/components/dashboard/seller-stats";

import { getAllUsers } from "@/services/userService";
import { getAllCompanies } from "@/services/companyService";
import {
  getProductSummary,
  getOutOfStockSummary,
  getOutOfStockDetails,
  OutOfStockItem,
} from "@/services/productService";
import { getGlobalSalesSummary } from "@/services/salesService";
import {
  getExpiringSubscriptionsAlert,
  getSubscriptionByUserId,
  SubscriptionDetail,
} from "@/services/subscriptionService";
import {
  createCompanyUser,
  getRoles,
  getUsersByCompany,
  createPlatformUser,
  Role,
} from "@/services/userService";
import { getCompanyProductCount } from "@/services/productService";
import { getCompanySalesSummary } from "@/services/salesService";
import {
  Company,
  createCompany as createCompanyService,
} from "@/services/companyService";
import {
  updateSubscription,
  cancelSubscription,
  createSubscription,
  getAllPlans,
  Plan,
} from "@/services/subscriptionService";
import { toast } from "sonner";
import ActionButton from "@/components/ui/action-button";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";

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

  const [companies, setCompanies] = useState<any[]>([]);

  // Company detail modal states
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [period, setPeriod] = useState("all");
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>(
    {},
  );

  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    if (auth?.accessToken) {
      getAllPlans(auth.accessToken).then(setPlans).catch(console.error);
      getRoles(auth.accessToken).then(setRoles).catch(console.error);
    }
  }, [auth]);

  useEffect(() => {
    const calculateDates = () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      let from: string | undefined;

      switch (period) {
        case "weekly":
          const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          from = lastWeek.toISOString().split("T")[0];
          break;
        case "monthly":
          const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          from = lastMonth.toISOString().split("T")[0];
          break;
        case "yearly":
          const lastYear = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          from = lastYear.toISOString().split("T")[0];
          break;
        default:
          from = undefined;
      }
      setDateRange({ from, to: from ? today : undefined });
    };

    calculateDates();
  }, [period]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && mounted && auth?.accessToken) {
      if (!isSuperadmin(auth?.user.email)) {
        router.push("/");
        return;
      }

      const fetchData = async () => {
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
            getExpiringSubscriptionsAlert(token, 7).catch(() => []),
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

          setOutOfStockItems(outOfStockList);
          setExpiringSubscriptions(expiringAlert);

          // Enrich companies with subscription info
          // Fetch subscription for each company's root user
          const enrichedCompanies = await Promise.all(
            allCompanies.map(async (company) => {
              // In a real scenario, we might want to fetch all subs once and map them
              // but here we can try to find the specific sub for the user_id
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
          console.error("Error fetching superadmin data:", error);
        }
      };

      fetchData();
    }
  }, [auth, loading, mounted, router]);

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

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Compañías"
          value={metrics.totalCompanies.toString()}
          icon={Building2}
          description="Empresas registradas"
        />
        <MetricCard
          title="Usuarios Totales"
          value={metrics.totalUsers.toString()}
          icon={Users}
          description="En toda la plataforma"
        />
        <MetricCard
          title="Ventas Totales (App Powip)"
          value={`S/ ${metrics.totalSales.toLocaleString()}`}
          icon={CreditCard}
          description={`${metrics.orderCount} órdenes en toda la app`}
          tooltip="Monto total acumulado de todas las compañías registradas en Powip."
        />
        <MetricCard
          title="Sin Stock"
          value={metrics.outOfStockCount.toString()}
          icon={TrendingUp}
          description="Variantes con stock cero"
          status={metrics.outOfStockCount > 0 ? "warning" : "success"}
        />
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Companies List */}
        <Card className="md:col-span-12 lg:col-span-5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Compañías Registradas</CardTitle>
                <CardDescription>
                  Detalle de suscripciones y vigencia.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresa..."
                    className="pl-8 h-9 w-[200px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow
                    key={company.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleCompanyClick(company)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1">
                          {company.name}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ID: {company.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-bold"
                      >
                        {company.plan || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>S/ {company.price || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.3 w-3.5 text-muted-foreground" />
                        {company.expiry || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={company.status || "ACTIVE"} />
                    </TableCell>
                  </TableRow>
                ))}
                {companies.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-4 text-muted-foreground"
                    >
                      No hay compañías registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Subscriptions Card */}
        <Card className="md:col-span-12 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Próximos Vencimientos</CardTitle>
            </div>
            <CardDescription>Vencen en los próximos 7 días.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expiringSubscriptions.length > 0 ? (
                expiringSubscriptions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-1 p-2 rounded-lg border bg-muted/30"
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className="text-xs font-mono truncate max-w-[120px]"
                        title={s.userId}
                      >
                        ID: {s.userId.substring(0, 8)}...
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {s.plan?.name}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Vence:
                      </span>
                      <span className="text-[10px] font-bold text-amber-600">
                        {s.endDate}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  No hay vencimientos próximos.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row with Out of Stock table */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <CardTitle>Productos sin Stock</CardTitle>
            </div>
            <CardDescription>
              Detalle de variantes que requieren reposición inmediata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outOfStockItems.map((item) => (
                  <TableRow key={item.variantId}>
                    <TableCell className="font-medium text-sm">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {item.sku}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-bold">
                      {item.availableStock}
                    </TableCell>
                  </TableRow>
                ))}
                {outOfStockItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay productos sin stock.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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
        users={metrics.totalUsers > 0 ? [] : []} // Placeholder for existing users if needed
      />

      <CreateUserModal
        isOpen={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
        auth={auth}
        roles={roles}
        companies={companies}
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

      const [users, productCount, sales] = await Promise.all([
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
      ]);

      setDetails({
        users,
        productCount,
        sales,
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

function CreateCompanyModal({ isOpen, onOpenChange, auth }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    userId: "",
    cuit: "",
    billingAddress: "",
    phone: "",
  });

  const handleSave = async () => {
    if (!auth?.accessToken) return;
    setLoading(true);
    try {
      await createCompanyService(auth.accessToken, formData);
      toast.success("Compañía creada con éxito");
      onOpenChange(false);
      window.location.reload(); // Refresh to see changes
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
            <Label>ID del Usuario Dueño</Label>
            <Input
              value={formData.userId}
              onChange={(e) =>
                setFormData({ ...formData, userId: e.target.value })
              }
              placeholder="ID del usuario en ms-auth"
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

function CreateUserModal({
  isOpen,
  onOpenChange,
  auth,
  roles,
  companies,
}: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    surname: "",
    identityDocument: "",
    roleName: "user",
    companyId: "none",
  });

  const handleSave = async () => {
    if (!auth?.accessToken) return;
    setLoading(true);
    try {
      if (formData.companyId && formData.companyId !== "none") {
        await createCompanyUser(
          formData.companyId,
          formData as any,
          auth.accessToken,
        );
      } else {
        await createPlatformUser(formData as any, auth.accessToken);
      }
      toast.success("Usuario creado con éxito");
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error("Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Crea una cuenta de usuario y opcionalmente vincúlala a una compañía.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input
                value={formData.surname}
                onChange={(e) =>
                  setFormData({ ...formData, surname: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={formData.roleName}
                onValueChange={(v) => setFormData({ ...formData, roleName: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Compañía (Opcional)</Label>
              <Select
                value={formData.companyId}
                onValueChange={(v) =>
                  setFormData({ ...formData, companyId: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin compañía" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin compañía</SelectItem>
                  {companies?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <ActionButton
            label="Registar Usuario"
            loadingLabel="Creando..."
            onClick={handleSave}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
