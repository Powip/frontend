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

  const config = {
    headers: { Authorization: authHeader }
  };

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Fetch data from microservices in parallel
    const [
      companyRes,
      salesRes,
      billingRes,
      subsRes
    ] = await Promise.allSettled([
      axios.get(`${API_COMPANY}/company`, config), // Removed includeStores if not needed or ensures it exists
      axios.get(`${API_VENTAS}/order-header/summary/global`, config),
      axios.get(`${API_VENTAS}/stats/billing/global`, config),
      axios.get(`${API_SUBS}/subscriptions`, config)
    ]);

    // Logging for debug in production
    if (companyRes.status === 'rejected') console.error("MS-COMPANY failure:", companyRes.reason?.message);
    if (salesRes.status === 'rejected') console.error("MS-VENTAS Summary failure:", salesRes.reason?.message);
    if (billingRes.status === 'rejected') console.error("MS-VENTAS Billing failure:", billingRes.reason?.message);
    if (subsRes.status === 'rejected') console.error("MS-SUBSCRIPTION failure:", subsRes.reason?.message);

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
      const price = s.plan?.price || s.price || 0;
      return acc + Number(price);
    }, 0);
    
    // MRR Nuevo (last 30 days)
    const newSubs = activeSubs.filter((s: any) => {
      const date = new Date(s.createdAt || s.created_at || s.startDate || s.start_date);
      return date >= thirtyDaysAgo;
    });
    const mrrNuevo = newSubs.reduce((acc: number, s: any) => acc + (s.plan?.price || s.price || 0), 0);

    // MRR Perdido (Proxy: Subscriptions cancelled/expired in last 30 days)
    const lostSubs = subscriptions.filter((s: any) => {
      const status = s.status?.toUpperCase();
      const isLost = status === 'CANCELLED' || status === 'INACTIVE' || status === 'EXPIRED';
      const date = new Date(s.updatedAt || s.updated_at || now);
      return isLost && date >= thirtyDaysAgo;
    });
    const mrrPerdido = lostSubs.reduce((acc: number, s: any) => acc + (s.plan?.price || s.price || 0), 0);

    // --- NRR & CHURN ---
    const mrrStartMonth = Math.max(0, totalMrr - mrrNuevo + mrrPerdido);
    const churnRate = mrrStartMonth > 0 ? (mrrPerdido / mrrStartMonth) * 100 : 0;
    const nrr = mrrStartMonth > 0 ? ((totalMrr) / mrrStartMonth) * 100 : 100;

    // --- ACTIVATION RATE ---
    // Activation: Percentage of active companies
    const activeCompanies = companies.filter((c: any) => c.is_active || c.status?.toUpperCase() === 'ACTIVE').length;
    const activationRate = companies.length > 0 ? (activeCompanies / companies.length) * 100 : 0;

    // --- GMV TOTAL ---
    const gmvTotal = Number(salesSummary.totalSales || salesSummary.total || 0);

    // --- STICKINESS (Operational Usage) ---
    // If we have billing stats, use them as proxy for active users
    const currentMonthData = globalBilling[globalBilling.length - 1];
    const stickiness = currentMonthData ? (Number(currentMonthData.currentOrders || 0) / (Math.max(1, companies.length) * 10)) * 100 : 25;

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
