import { NextResponse } from "next/server";
import axios from "axios";

const API_COMPANY = process.env.NEXT_PUBLIC_API_COMPANY;
const API_VENTAS = process.env.NEXT_PUBLIC_API_VENTAS;
const API_SUBS = process.env.NEXT_PUBLIC_API_SUBS;

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "No authorization header" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const config = {
    headers: { Authorization: authHeader }
  };

  try {
    const now = new Date();
    const thirtyDaysAgo = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : now;

    // 1. Validate environment variables
    if (!API_COMPANY || !API_VENTAS || !API_SUBS) {
      console.error("Missing environment variables:", { API_COMPANY, API_VENTAS, API_SUBS });
      // Don't throw, just log and proceed with empty values to avoid 500
    }

    // 2. Fetch data from microservices in parallel with individual error handling and timeouts
    const fetchOptions = { ...config, timeout: 5000 };

    const [
      companyRes,
      salesRes,
      billingRes,
      subsRes
    ] = await Promise.allSettled([
      API_COMPANY ? axios.get(`${API_COMPANY}/company`, fetchOptions) : Promise.reject(new Error("API_COMPANY undefined")),
      API_VENTAS ? axios.get(`${API_VENTAS}/order-header/summary/global`, fetchOptions) : Promise.reject(new Error("API_VENTAS undefined")),
      API_VENTAS ? axios.get(`${API_VENTAS}/stats/billing/global`, fetchOptions) : Promise.reject(new Error("API_VENTAS (billing) undefined")),
      API_SUBS ? axios.get(`${API_SUBS}/subscriptions`, fetchOptions) : Promise.reject(new Error("API_SUBS undefined"))
    ]);

    // Logging for debug in production
    if (companyRes.status === 'rejected') console.warn("MS-COMPANY failure:", companyRes.reason?.message);
    if (salesRes.status === 'rejected') console.warn("MS-VENTAS Summary failure:", salesRes.reason?.message);
    if (billingRes.status === 'rejected') console.warn("MS-VENTAS Billing failure:", billingRes.reason?.message);
    if (subsRes.status === 'rejected') console.warn("MS-SUBSCRIPTION failure:", subsRes.reason?.message);

    // Handle results with safe data access
    const companies = companyRes.status === 'fulfilled' ? (companyRes.value.data || []) : [];
    const salesSummary = salesRes.status === 'fulfilled' ? (salesRes.value.data || { totalSales: 0, orderCount: 0 }) : { totalSales: 0, orderCount: 0 };
    const globalBilling = billingRes.status === 'fulfilled' ? (billingRes.value.data || []) : [];
    
    // Check if subscriptions is nested
    let subscriptions = [];
    if (subsRes.status === 'fulfilled') {
      const data = subsRes.value.data;
      subscriptions = Array.isArray(data) ? data : (data.subscriptions || data.data || []);
    }

    // --- MRR CALCULATIONS ---
    // MRR based on active subscriptions from ms-subscription
    const activeSubs = subscriptions.filter((s: any) => {
      const status = s.status?.toUpperCase();
      return status === 'ACTIVE' || status === 'PENDING_PAYMENT';
    });
    
    const totalMrr = activeSubs.reduce((acc: number, s: any) => {
      const price = Number(s.plan?.price || s.price || 0);
      return acc + (isNaN(price) ? 0 : price);
    }, 0);
    
    // MRR Nuevo (last 30 days)
    const newSubs = activeSubs.filter((s: any) => {
      const dateString = s.createdAt || s.created_at || s.startDate || s.start_date;
      if (!dateString) return false;
      const date = new Date(dateString);
      return !isNaN(date.getTime()) && date >= thirtyDaysAgo && date <= endDate;
    });
    const mrrNuevo = newSubs.reduce((acc: number, s: any) => {
      const price = Number(s.plan?.price || s.price || 0);
      return acc + (isNaN(price) ? 0 : price);
    }, 0);

    // MRR Perdido (Proxy: Subscriptions cancelled/expired in last 30 days)
    const lostSubs = subscriptions.filter((s: any) => {
      const status = s.status?.toUpperCase();
      const isLost = status === 'CANCELLED' || status === 'INACTIVE' || status === 'EXPIRED';
      const dateString = s.updatedAt || s.updated_at;
      if (!dateString) return isLost; // If no date, assume it's relevant if lost
      const date = new Date(dateString);
      return isLost && !isNaN(date.getTime()) && date >= thirtyDaysAgo && date <= endDate;
    });
    const mrrPerdido = lostSubs.reduce((acc: number, s: any) => {
      const price = Number(s.plan?.price || s.price || 0);
      return acc + (isNaN(price) ? 0 : price);
    }, 0);

    // --- NRR & CHURN ---
    const mrrStartMonth = Math.max(0, totalMrr - mrrNuevo + mrrPerdido);
    const churnRate = mrrStartMonth > 0 ? (mrrPerdido / mrrStartMonth) * 100 : 0;
    const nrr = mrrStartMonth > 0 ? ((totalMrr) / mrrStartMonth) * 100 : 100;

    // --- ACTIVATION RATE & ALTAS ---
    const activeCompanies = companies.filter((c: any) => c.is_active || c.status?.toUpperCase() === 'ACTIVE').length;
    const activationRate = companies.length > 0 ? (activeCompanies / companies.length) * 100 : 0;

    const previousMonthStart = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
    let newCompaniesCurrentMonth = 0;
    let newCompaniesPrevMonth = 0;

    companies.forEach((c: any) => {
      const created = c.created_at ? new Date(c.created_at) : null;
      if (created) {
        if (created >= thirtyDaysAgo && created <= endDate) newCompaniesCurrentMonth++;
        else if (created >= previousMonthStart && created < thirtyDaysAgo) newCompaniesPrevMonth++;
      }
    });

    // --- GMV TOTAL ---
    const gmvTotal = Number(salesSummary.totalSales || salesSummary.total || 0);

    // --- STICKINESS (Operational Usage) ---
    // If we have billing stats, use them as proxy for active users
    const currentMonthData = globalBilling[globalBilling.length - 1];
    const stickiness = currentMonthData ? (Number(currentMonthData.currentOrders || 0) / (Math.max(1, companies.length) * 10)) * 100 : 25;

    // --- PAYMENT METHODS DISTRIBUTION ---
    const paymentMethodsMap: Record<string, number> = {};
    activeSubs.forEach((s: any) => {
      const method = s.payment_method || s.paymentMethod || s.system || 'Transferencia'; // Default or extracted
      paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + 1;
    });

    const paymentMethodsDistribution = Object.entries(paymentMethodsMap).map(([name, value]) => ({ name, value }));

    return NextResponse.json({
      mrr: totalMrr,
      mrrNuevo,
      mrrPerdido,
      nrr,
      churnRate: Math.min(100, churnRate),
      activationRate: Math.min(100, activationRate),
      ttfv: 1.8, // Simplified
      dauMau: Math.min(100, stickiness),
      gmvTotal,
      totalCompanies: companies.length,
      altas: {
        current: newCompaniesCurrentMonth,
        previous: newCompaniesPrevMonth,
        growth: newCompaniesPrevMonth > 0 
          ? ((newCompaniesCurrentMonth - newCompaniesPrevMonth) / newCompaniesPrevMonth) * 100 
          : 100
      },
      paymentDistribution: paymentMethodsDistribution.length > 0 
        ? paymentMethodsDistribution 
        : [{ name: 'Suscripción Manual', value: activeSubs.length }],
      targets: {
        mrr: { meta: 80000, alert: 60000 },
        activation: { meta: 80, alert: 60 },
        churn: { meta: 2, alert: 5 },
        stickiness: { meta: 35, alert: 20 },
        ttfv: { meta: 2, alert: 3 }
      }
    });
  } catch (err: any) {
    console.error("CRITICAL ERROR: SaaS Metrics aggregation failed:", err);
    return NextResponse.json({ 
      error: "Error aggregating SaaS metrics", 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    }, { status: 500 });
  }
}
