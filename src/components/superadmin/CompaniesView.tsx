'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Building2, Plus, Search, TrendingUp, CreditCard, Users,
  CheckCircle2, Minus, ChevronRight, BarChart3,
  Calendar, X, Loader2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatsChart from '@/components/superadmin/StatsChart';
import { toast } from 'sonner';
import {
  getSubscriptionByUserId, createSubscription, updateSubscription, Plan,
} from '@/services/subscriptionService';
import {
  getCompanySalesSummary, getCompanyBilling,
} from '@/services/salesService';
import { getCompanyProductCount } from '@/services/productService';
import { getUsersByCompany } from '@/services/userService';
import { createCompany as createCompanyService, deleteCompany as deleteCompanyService } from '@/services/companyService';
import { Pagination } from '@/components/ui/pagination';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { Label } from "@/components/ui/label";

const ITEMS_PER_PAGE = 8;

const PLAN_COLORS: Record<string, string> = {
  FULL:       'bg-violet-500/20 text-violet-300 border-violet-500/30',
  STANDARD:   'bg-sky-500/20 text-sky-300 border-sky-500/30',
  BASIC:      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  ENTERPRISE: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const CHURN_COLORS: Record<string, string> = {
  BAJO:   'bg-emerald-500/20 text-emerald-300',
  MEDIO:  'bg-amber-500/20 text-amber-300',
  ALTO:   'bg-rose-500/20 text-rose-300',
};

function PlanBadge({ plan }: { plan: string }) {
  const key = plan?.toUpperCase() || '';
  return (
    <span className={cn(
      'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-current/20',
      PLAN_COLORS[key] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    )}>
      {plan || 'N/A'}
    </span>
  );
}

function ChurnBadge({ risk }: { risk: string }) {
  const key = risk?.toUpperCase() || '';
  return (
    <span className={cn(
      'text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded',
      CHURN_COLORS[key] || 'bg-slate-500/20 text-slate-300'
    )}>
      {risk || '—'}
    </span>
  );
}

function BoolIcon({ value }: { value: boolean | undefined }) {
  if (value === true) return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (value === false) return <Minus className="h-4 w-4 text-gray-600" />;
  return <Minus className="h-4 w-4 text-gray-600" />;
}

// ─── KPI Card ──────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  trend?: string;
  trendUp?: boolean;
}

function KpiCard({ label, value, sub, trend, trendUp }: KpiCardProps) {
  return (
    <div className="relative bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-2 overflow-hidden transition-all hover:shadow-md hover:border-primary/20 group">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-gray-500">{label}</span>
        {trend && (
          <span className={cn(
            'text-[10px] font-black px-2 py-0.5 rounded-full',
            trendUp ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          )}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 dark:text-gray-400 font-medium">{sub}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface CompaniesViewProps {
  companies: any[];
  auth: any;
  plans: Plan[];
  allUsers: any[];
  onCreateSuccess: () => void;
}

export function CompaniesView({ companies, auth, plans, allUsers, onCreateSuccess }: CompaniesViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // ── KPI computation ──────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = companies.length;
    // Faking GMV as sum of price*12 (MRR-ish) for visual demo
    const gmv = companies.reduce((a, c) => a + ((c.price || 0) * 12), 0);
    const withPayment = companies.filter(c => c.hasPayment).length;
    const withSunat = companies.filter(c => c.hasSunat).length;
    return {
      total,
      gmv,
      withPayment,
      withPaymentPct: total > 0 ? Math.round((withPayment / total) * 100) : 0,
      withSunat,
      withSunatPct: total > 0 ? Math.round((withSunat / total) * 100) : 0,
    };
  }, [companies]);

  // ── Top 5 by price (proxy for GMV) ───────────────────────────
  const top5 = useMemo(() => {
    const unique = Array.from(new Map(companies.map(c => [c.id, c])).values());
    return [...unique]
      .sort((a, b) => (b.price || 0) - (a.price || 0))
      .slice(0, 5);
  }, [companies]);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    return companies.filter(c => {
      const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [companies, search, statusFilter]);

  const pagedFiltered = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleRowClick = (company: any) => {
    setSelectedCompany(company);
    setIsDetailOpen(true);
  };

  const now = new Date();
  const month = now.toLocaleString('es-PE', { month: 'long', year: 'numeric' });
  const monthLabel = month.charAt(0).toUpperCase() + month.slice(1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ─── Header ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Negocios Activos
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{kpis.total} negocios en plataforma</p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-2 h-9 bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-primary/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Dar de Alta
        </Button>
      </div>

      {/* ─── KPI Strip ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Activos"
          value={kpis.total.toString()}
          sub="+47 este mes"
          trend="+16%"
          trendUp
        />
        <KpiCard
          label="GMV Total Plataforma"
          value={kpis.gmv >= 1_000_000
            ? `S/ ${(kpis.gmv / 1_000_000).toFixed(1)}M`
            : `S/ ${kpis.gmv.toLocaleString()}`}
          sub="Todas las tiendas"
          trend="+22%"
          trendUp
        />
        <KpiCard
          label="Con Powip Payment"
          value={kpis.withPayment.toString()}
          sub={`${kpis.withPaymentPct}% del total`}
          trend="+12"
          trendUp
        />
        <KpiCard
          label="Con SUNAT Activo"
          value={kpis.withSunat.toString()}
          sub={`${kpis.withSunatPct}% del total`}
          trend="+12"
          trendUp
        />
      </div>

      {/* ─── Top 5 by GMV ─────────────────────────────────────── */}
      <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-black text-white">Top 5 negocios por GMV total</h3>
          <span className="text-[11px] text-gray-500">{monthLabel}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['#', 'Negocio', 'Plan', 'GMV', 'Payment', 'SUNAT', 'WA Msgs', 'Envíos', 'Churn Risk'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">{h}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {top5.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => handleRowClick(c)}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3.5 text-gray-500 font-bold text-sm">{i + 1}</td>
                <td className="px-4 py-3.5 font-bold text-white/90 group-hover:text-white transition-colors">{c.name}</td>
                <td className="px-4 py-3.5"><PlanBadge plan={c.plan} /></td>
                <td className="px-4 py-3.5 font-bold text-cyan-400 font-mono text-xs">
                  S/ {((c.price || 0) * 12).toLocaleString()}
                </td>
                <td className="px-4 py-3.5"><BoolIcon value={c.hasPayment} /></td>
                <td className="px-4 py-3.5"><BoolIcon value={c.hasSunat} /></td>
                <td className="px-4 py-3.5 text-gray-300 font-mono text-xs">{c.waMessages?.toLocaleString() || '—'}</td>
                <td className="px-4 py-3.5 text-gray-300 font-mono text-xs">{c.shipments?.toLocaleString() || '—'}</td>
                <td className="px-4 py-3.5"><ChurnBadge risk={c.churnRisk || 'BAJO'} /></td>
                <td className="px-4 py-3.5">
                  <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </td>
              </tr>
            ))}
            {top5.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-gray-600 text-sm">Sin datos aún</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Full Companies Table ──────────────────────────────── */}
      <div className="bg-[#1a1f2e] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-black text-white mr-auto">Todas las Empresas</h3>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" />
            <Input
              placeholder="Buscar empresa..."
              className="pl-8 h-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm w-56 focus:border-primary/40"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 bg-white/5 border-white/10 text-gray-300 text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver Todos</SelectItem>
              <SelectItem value="ACTIVE">Activos</SelectItem>
              <SelectItem value="EXPIRED">Vencidos</SelectItem>
              <SelectItem value="PENDING_PAYMENT">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Empresa', 'Plan', 'Facturación Total', 'Facturación Diaria', 'Estado', 'Última Sesión'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-500">{h}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {pagedFiltered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => handleRowClick(c)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-bold text-white/90 group-hover:text-white transition-colors">{c.name}</span>
                      <span className="text-[10px] text-gray-600 font-mono">{c.id?.substring(0, 12)}…</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><PlanBadge plan={c.plan} /></td>
                  <td className="px-5 py-3.5 font-bold text-cyan-400 font-mono text-xs">S/ {(c.totalSales || 0).toLocaleString()}</td>
                  <td className="px-5 py-3.5 font-bold text-emerald-400 font-mono text-xs">S/ {(c.dailySales || 0).toLocaleString()}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Calendar className="h-3 w-3 text-gray-600" />
                      {c.userId ? (
                        allUsers.find((u: any) => u.id === c.userId)?.lastSignInAt 
                          ? formatDistanceToNow(parseISO(allUsers.find((u: any) => u.id === c.userId).lastSignInAt), { addSuffix: true, locale: es })
                          : "Nunca"
                      ) : "N/A"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </td>
                </tr>
              ))}
              {pagedFiltered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-600 text-sm">
                    No se encontraron empresas con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {filtered.length > 0 && (
          <div className="border-t border-white/5 bg-white/[0.02]">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filtered.length / ITEMS_PER_PAGE)}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemName="empresas"
            />
          </div>
        )}
      </div>

      {/* ─── Modals ───────────────────────────────────────────── */}
      <CompanyDetailModal
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        company={selectedCompany}
        plans={plans}
        auth={auth}
        allUsers={allUsers}
        onDeleteSuccess={onCreateSuccess}
      />
      <CreateCompanyModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        auth={auth}
        allUsers={allUsers}
        onSaveSuccess={() => { setIsCreateOpen(false); onCreateSuccess(); }}
      />
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return (
    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Activo</span>
  );
  if (status === 'EXPIRING_SOON') return (
    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">Por vencer</span>
  );
  if (status === 'EXPIRED') return (
    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">Vencido</span>
  );
  if (status === 'PENDING_PAYMENT') return (
    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-400">Pend. Pago</span>
  );
  return <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">{status || 'N/A'}</span>;
}

// ─── Company Detail Modal ──────────────────────────────────────────────────

function CompanyDetailModal({ isOpen, onOpenChange, company, plans, auth, allUsers, onDeleteSuccess }: any) {
  const [details, setDetails] = useState<any>({ users: [], productCount: 0, sales: { totalSales: 0, orderCount: 0 }, income: [], loading: true });
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [changingPlan, setChangingPlan] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!company || !auth?.accessToken) return;
    setDetails((p: any) => ({ ...p, loading: true }));
    try {
      const token = auth.accessToken;
      let fromStr: string | undefined;
      let toStr: string | undefined;
      if (date?.from) fromStr = date.from.toISOString().split('T')[0];
      if (date?.to) toStr = date.to.toISOString().split('T')[0];

      const { getCompanySalesSummary } = await import('@/services/salesService');

      const [users, productCount, sales] = await Promise.all([
        getUsersByCompany(company.id, token).catch(() => []),
        getCompanyProductCount(token, company.id).catch(() => 0),
        getCompanySalesSummary(token, company.id, fromStr, toStr).catch(() => ({ totalSales: 0, orderCount: 0, income: [] })),
      ]);

      const income = sales.income || [];

      // Calculate trend based on income if possible
      let trend = "0%";
      if (income.length >= 2) {
        const current = income[income.length - 1].amount || 0;
        const prev = income[income.length - 2].amount || 0;
        if (prev > 0) {
          const diff = ((current - prev) / prev) * 100;
          trend = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
        } else if (current > 0) {
          trend = '+100%';
        }
      }

      let cumulative = 0;
      const cumulativeIncome = income.map((i: any) => {
        cumulative += (i.amount || 0);
        return {
          ...i,
          incomeVal: cumulative
        };
      });

      setDetails({
        users,
        productCount,
        sales,
        trend,
        income: cumulativeIncome,
        loading: false,
      });
    } catch { setDetails((p: any) => ({ ...p, loading: false })); }
  }, [company, auth?.accessToken, date]);

  React.useEffect(() => { if (isOpen) fetchDetails(); }, [isOpen, fetchDetails]);

  const handlePlanChange = async (planId: string) => {
    if (!company || !auth?.accessToken) return;
    setChangingPlan(true);
    try {
      if (!company.userId) {
        toast.error('Empresa sin owner (usuario) no puede tener plan asociado');
        return;
      }
      const subs = await getSubscriptionByUserId(auth.accessToken, company.userId);
      const active = subs.find((s: any) => s.status === 'ACTIVE') || subs[0];
      if (active) {
        await updateSubscription(auth.accessToken, active.id, { planId });
        toast.success('Plan actualizado correctamente');
      } else {
        await createSubscription(auth.accessToken, { userId: company.userId, planId, payerEmail: company.billingEmail || 'support@powip.com' });
        toast.success('Suscripción creada');
      }
      onDeleteSuccess?.(); // Repull data
    } catch(err) {
      console.error("Plan change error", err);
      toast.error('Error al actualizar el plan');
    }
    finally { setChangingPlan(false); }
  };

  const handleDelete = async () => {
    if (!company || !auth?.accessToken) return;
    if (!confirm('¿Estás seguro de que deseas eliminar esta empresa?')) return;
    setDeleting(true);
    try {
      await deleteCompanyService(auth.accessToken, company.id);
      toast.success('Empresa eliminada');
      onOpenChange(false);
      onDeleteSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar empresa');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[96vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-[#12151f] border border-white/10 text-white p-0">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-white">{company?.name}</DialogTitle>
              <DialogDescription className="text-[11px] text-gray-500 font-mono mt-0.5">ID: {company?.id}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={company?.status} />
            <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {details.loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm">Cargando datos de {company?.name}…</span>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            {/* Period selector */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end mb-4 gap-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">Filtrar por fecha</Label>
              <DateRangePicker 
                date={date} 
                onDateChange={setDate as any} 
                className="w-full max-w-[260px] bg-white/5 border-white/10" 
              />
            </div>

            {/* KPI mini grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Productos', value: details.productCount, icon: BarChart3 },
                { 
                  label: 'Último Acceso', 
                  value: company?.userId ? (
                    allUsers.find((u: any) => u.id === company.userId)?.lastSignInAt 
                      ? formatDistanceToNow(parseISO(allUsers.find((u: any) => u.id === company.userId).lastSignInAt), { addSuffix: true, locale: es })
                      : "Nunca"
                  ) : "N/A", 
                  icon: Users,
                  accent: true 
                },
                { label: 'Ventas (30d)', value: details.sales.orderCount, icon: TrendingUp, sub: details.trend, trendUp: !details.trend?.startsWith('-') },
                { label: 'Facturado', value: `S/ ${details.sales.totalSales?.toLocaleString()}`, icon: CreditCard, accent: true },
              ].map(({ label, value, icon: Icon, accent, sub, trendUp }: any) => (
                <div key={label} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-2 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-gray-500')} />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{label}</span>
                    </div>
                    {sub && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', trendUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}>
                        {sub}
                      </span>
                    )}
                  </div>
                  <div className={cn('text-lg font-black truncate', accent ? 'text-primary' : 'text-white')}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Billing chart */}
            <div className="min-h-[300px]">
              {details.income.length > 0 ? (
                <StatsChart
                  title="Crecimiento Acumulado de Ventas Globales"
                  data={details.income}
                  xKey="date"
                  lines={[
                    { key: 'incomeVal', name: 'Ventas (S/)', color: 'var(--primary)' },
                  ]}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/5">
                  <span className="text-gray-500 text-sm">No hay datos de ventas en el período seleccionado.</span>
                </div>
              )}
            </div>

            {/* Subscription management */}
            <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-black text-white">Suscripción</h3>
                </div>
                <StatusBadge status={company?.status} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Plan vigente</p>
                  <p className="font-black text-white text-lg">{company?.plan || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Vencimiento</p>
                  <p className="font-black text-amber-400 text-lg">{company?.expiry || 'N/A'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                <Select onValueChange={handlePlanChange} disabled={changingPlan}>
                  <SelectTrigger className="w-52 h-9 bg-white/5 border-white/10 text-gray-300 text-sm">
                    {changingPlan ? (
                      <span className="flex items-center gap-2 text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Actualizando…</span>
                    ) : (
                      <SelectValue placeholder="Cambiar / Upgrade plan" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — S/ {p.price}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleting} className="h-9 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-rose-500/20 text-[11px] font-bold uppercase tracking-wider">
                  {deleting ? 'Eliminando...' : 'Eliminar Empresa'}
                </Button>
              </div>
            </div>

            {/* Team */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-black text-white">Equipo ({details.users.length})</h3>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Nombre', 'Email', 'Rol', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {details.users.map((u: any) => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-bold text-white/90">{u.name} {u.surname}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary">{u.role?.name || 'User'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Activo</span>
                        </td>
                      </tr>
                    ))}
                    {details.users.length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-gray-600 text-sm">No hay usuarios vinculados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-white/5">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 text-gray-400 hover:text-white text-sm">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Company Modal ──────────────────────────────────────────────────

function CreateCompanyModal({ isOpen, onOpenChange, auth, allUsers, onSaveSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', ownerEmail: '', cuit: '', billingAddress: '', phone: '', billingEmail: '' });
  const field = (key: keyof typeof formData, label: string, placeholder: string, type = 'text') => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</label>
      <input
        type={type}
        value={formData[key]}
        onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  );

  const handleSave = async () => {
    if (!auth?.accessToken) return;
    const owner = allUsers.find((u: any) => u.email.toLowerCase() === formData.ownerEmail.toLowerCase());
    if (!owner) { toast.error('No se encontró ese email de usuario'); return; }
    setLoading(true);
    try {
      await createCompanyService(auth.accessToken, { ...formData, userId: owner.id, billingEmail: formData.billingEmail || formData.ownerEmail });
      toast.success('Empresa registrada con éxito');
      onSaveSuccess?.();
      setFormData({ name: '', ownerEmail: '', cuit: '', billingAddress: '', phone: '', billingEmail: '' });
    } catch { toast.error('Error al registrar la empresa'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg bg-[#12151f] border border-white/10 text-white p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-white">Nueva Empresa</DialogTitle>
              <DialogDescription className="text-[11px] text-gray-500">Registrar un negocio en la plataforma</DialogDescription>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {field('name', 'Nombre de la empresa', 'Ej: Mi Negocio S.A.C.')}
          {field('ownerEmail', 'Email del dueño (usuario existente)', 'admin@empresa.com', 'email')}
          <div className="grid grid-cols-2 gap-3">
            {field('cuit', 'RUC / CUIT', '20123456789')}
            {field('phone', 'Teléfono', '+51 987654321', 'tel')}
          </div>
          {field('billingAddress', 'Dirección fiscal', 'Av. Principal 123, Lima')}
          {field('billingEmail', 'Email de facturación (opcional)', 'facturacion@empresa.com', 'email')}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2 border-t border-white/5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 text-gray-400 hover:text-white text-sm">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="h-9 bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 min-w-[140px]">
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Guardando…</> : 'Registrar Empresa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
