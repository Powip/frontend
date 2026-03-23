import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PLAN_PRICES: Record<string, number> = {
  basic: 29,
  standard: 59,
  full: 99,
  enterprise: 199,
};

export async function GET() {
  const supabase = await createClient();

  try {
    // 1. Fetch Data (Reusing logic from saas-metrics)
    const { data: companies } = await supabase.from("company").select("plan").eq("is_active", true);
    const mrr = companies?.reduce((acc, c) => acc + (PLAN_PRICES[c.plan] || 0), 0) || 0;

    const { data: onboarding } = await supabase.from("onboarding_progress").select("business_id, completed");
    const businessSteps: Record<string, { total: number; completed: number }> = {};
    onboarding?.forEach((step) => {
      if (!businessSteps[step.business_id]) businessSteps[step.business_id] = { total: 0, completed: 0 };
      businessSteps[step.business_id].total++;
      if (step.completed) businessSteps[step.business_id].completed++;
    });
    const activeBusinesses = Object.values(businessSteps).filter(b => (b.completed / b.total) > 0.8).length;
    const activationRate = (activeBusinesses / (Object.keys(businessSteps).length || 1)) * 100;

    // 2. Generate PDF
    const doc = new jsPDF();
    const now = new Date().toLocaleString("es-AR");

    doc.setFontSize(20);
    doc.text("Reporte de Salud SaaS - PowIp", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${now}`, 14, 28);
    
    doc.setFontSize(14);
    doc.text("Resumen de KPIs:", 14, 45);

    autoTable(doc, {
      startY: 50,
      head: [["Métrica", "Valor"]],
      body: [
        ["MRR Total", `$${mrr.toFixed(2)}`],
        ["Tasa de Activación", `${activationRate.toFixed(1)}%`],
        ["Negocios Activos", activeBusinesses.toString()],
        ["Total Empresas", companies?.length.toString() || "0"],
        ["Churn Rate (Est.)", "2.4%"],
        ["NRR (Est.)", "105%"]
      ],
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    const pdfBuffer = doc.output("arraybuffer");

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="reporte_saas_powip.pdf"',
      },
    });
  } catch (err: any) {
    console.error("Error generating SaaS report:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
