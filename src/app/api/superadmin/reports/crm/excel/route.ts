import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const supabase = await createClient();

  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("contact_name, business_name, email, phone_whatsapp, pipeline_stage, plan_interest, created_at, source")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("CRM Leads");

    worksheet.columns = [
      { header: "Nombre", key: "contact_name", width: 25 },
      { header: "Empresa", key: "business_name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "WhatsApp", key: "phone_whatsapp", width: 20 },
      { header: "Etapa", key: "pipeline_stage", width: 15 },
      { header: "Plan Interés", key: "plan_interest", width: 15 },
      { header: "Creado", key: "created_at", width: 20 },
      { header: "Fuente", key: "source", width: 15 },
    ];

    worksheet.addRows(leads);

    // Estilo para el encabezado
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="reporte_crm_powip.xlsx"',
      },
    });
  } catch (err: any) {
    console.error("Error generating CRM report:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
