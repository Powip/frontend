import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

const PLAN_PRICES: Record<string, number> = {
  basic: 99,
  standard: 189,
  full: 299,
  enterprise: 499,
};

export async function GET() {
  const supabase = await createClient();

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Fetch ALL relevant data in parallel for efficiency
    const [
      { data: companies, error: companyError },
      { data: onboarding, error: onboardingError },
      { data: stores, error: storesError },
      { data: orders, error: ordersError },
    ] = await Promise.all([
      supabase.from("company").select("id, plan, is_active, created_at, deleted_at, disabled_at"),
      supabase.from("onboarding_progress").select("business_id, completion_pct, created_at"),
      supabase.from("stores").select("id, company_id"),
      supabase.from("orderHeader").select("grandTotal, created_at, status, storeId").neq("status", "ANULADO"),
    ]);

    if (companyError) {
      console.error("Company Error:", companyError);
      throw companyError;
    }
    if (onboardingError) {
      console.error("Onboarding Error:", onboardingError);
      throw onboardingError;
    }
    if (storesError) {
      console.error("Stores Error:", storesError);
      throw storesError;
    }
    if (ordersError) {
      console.error("Orders Error:", ordersError);
      throw ordersError;
    }

    // Map stores for quick lookup
    const storeMap = new Map((stores || []).map(s => [s.id, s.company_id]));
    
    // Enrich orders with business_id (company_id)
    const enrichedOrders = (orders || []).map(o => ({
      ...o,
      business_id: storeMap.get(o.storeId) || null
    }));

    // --- MRR CALCULATIONS ---
    const activeCompanies = companies?.filter(c => c.is_active && !c.deleted_at && !c.disabled_at) || [];
    
    const safeGetPrice = (plan: any) => {
      if (!plan || typeof plan !== 'string') return 0;
      return PLAN_PRICES[plan.toLowerCase()] || 0;
    };

    const totalMrr = activeCompanies.reduce((acc, c) => acc + safeGetPrice(c.plan), 0);
    const newCompanies = companies?.filter(c => c.created_at && new Date(c.created_at) >= thirtyDaysAgo) || [];
    const mrrNuevo = newCompanies.reduce((acc, c) => acc + safeGetPrice(c.plan), 0);
    
    const lostCompanies = companies?.filter(c => 
      (c.deleted_at && new Date(c.deleted_at) >= thirtyDaysAgo) || 
      (c.disabled_at && new Date(c.disabled_at) >= thirtyDaysAgo)
    ) || [];
    const mrrPerdido = lostCompanies.reduce((acc, c) => acc + safeGetPrice(c.plan), 0);

    // --- NRR & CHURN ---
    const mrrStartMonth = totalMrr - mrrNuevo + mrrPerdido;
    const churnRate = mrrStartMonth > 0 ? (mrrPerdido / mrrStartMonth) * 100 : 0;
    const nrr = mrrStartMonth > 0 ? ((mrrStartMonth + mrrNuevo - mrrPerdido) / mrrStartMonth) * 100 : 100;

    // --- ACTIVATION RATE ---
    // Negocios creados en los últimos 7 días con > 50% onboarding
    const newInLast7Days = companies?.filter(c => new Date(c.created_at) >= sevenDaysAgo) || [];
    const activatedInLast7Days = onboarding?.filter(o => 
      new Date(o.created_at) >= sevenDaysAgo && Number(o.completion_pct) > 50
    ) || [];
    
    // Contar únicos
    const uniqueActivated = new Set(activatedInLast7Days.map(o => o.business_id)).size;
    const activationRate = newInLast7Days.length > 0 ? (uniqueActivated / newInLast7Days.length) * 100 : 0;

    // --- TTFV (Time to First Value) ---
    // Average Time to First Value (TTFV) - Time between company creation and first order
    const ttfvDays = companies?.map(c => {
      const firstOrder = enrichedOrders
        .filter((o: any) => o.business_id === c.id)
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      
      if (!firstOrder) return null;
      const diff = new Date(firstOrder.created_at).getTime() - new Date(c.created_at).getTime();
      return diff / (1000 * 60 * 60 * 24);
    }).filter(d => d !== null) as number[];

    const ttfv = ttfvDays.length > 0 ? ttfvDays.reduce((sum, d) => sum + Math.max(0, d), 0) / ttfvDays.length : 0;

    // --- STICKINESS (DAU/MAU) ---
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const isoThirtyDaysAgo = thirtyDaysAgo.toISOString();

    let dauPrev = 0;
    let mauPrev = 0;

    try {
      const { count: dau } = await supabase
        .from("auth.users")
        .select("*", { count: "exact", head: true })
        .gte("last_sign_in_at", oneDayAgo);
      
      const { count: mau } = await supabase
        .from("auth.users")
        .select("*", { count: "exact", head: true })
        .gte("last_sign_in_at", isoThirtyDaysAgo);
      
      dauPrev = dau || 0;
      mauPrev = mau || 0;
    } catch (e) {
      console.warn("Could not fetch auth users for stickiness, using defaults:", e);
      // Fallback: estimate from company creation if no auth access
      dauPrev = activeCompanies.length * 0.2; // Estimate 20% activity
      mauPrev = activeCompanies.length;
    }

    const dauMau = mauPrev ? (dauPrev / mauPrev) * 100 : 0;

    // --- GMV TOTAL ---
    const gmvTotal = enrichedOrders.reduce((acc, o) => acc + Number(o.grandTotal || 0), 0) || 0;

    return NextResponse.json({
      mrr: totalMrr,
      mrrNuevo,
      mrrPerdido,
      nrr,
      churnRate,
      activationRate,
      ttfv,
      dauMau,
      gmvTotal,
      totalCompanies: activeCompanies.length,
      targets: {
        mrr: { meta: 80000, alert: 60000 },
        activation: { meta: 75, alert: 50 },
        churn: { meta: 3, alert: 5 },
        stickiness: { meta: 30, alert: 15 },
        ttfv: { meta: 2, alert: 4 }
      }
    });
  } catch (err: any) {
    console.error("Error fetching SaaS metrics - STACK:", err.stack);
    console.error("Error fetching SaaS metrics - FULL:", err);
    return NextResponse.json({ error: err.message, details: err.stack }, { status: 500 });
  }
}
