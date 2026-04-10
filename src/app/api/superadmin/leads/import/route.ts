import { NextResponse } from 'next/server';
import { createRouteClient } from '@/utils/supabase/api';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  const supabase = await createRouteClient(request);
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (!rows || rows.length <= 1) {
      return NextResponse.json({ error: 'El archivo está vacío o no tiene datos' }, { status: 400 });
    }

    // Skip header row
    const dataRows = rows.slice(1);
    const importedLeads = [];
    let importedCount = 0;

    const normalizePhone = (phone: any) => {
      if (!phone) return '';
      const s = String(phone).replace(/\D/g, '');
      if (s.length === 9) return '+51' + s;
      if (s.startsWith('51') && s.length === 11) return '+' + s;
      return '+' + s;
    };

    const parseOrders = (val: any) => {
      if (!val) return null;
      const match = String(val).match(/\d+/);
      return match ? parseInt(match[0]) : null;
    };

    const parseDate = (val: any) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
      } catch {
        return null;
      }
    };

    for (const row of dataRows) {
      // mapping based on user provide list (0-indexed)
      const contact_name = String(row[0] || '').trim();
      const phone_whatsapp = normalizePhone(row[2]);
      const email = String(row[3] || '').trim();
      const business_name = String(row[6] || '').trim();
      const city = String(row[8] || '').trim();
      const orders_per_day = parseOrders(row[13]);
      const estadoRaw = String(row[18] || '').toLowerCase();
      const demo_date = parseDate(row[19]);

      if (!contact_name || !phone_whatsapp) continue;

      // Map ESTADO to pipeline_stage
      let pipeline_stage = 'nuevo';
      if (estadoRaw.includes('contact')) pipeline_stage = 'contactado';
      if (estadoRaw.includes('demo') || estadoRaw.includes('agend')) pipeline_stage = 'demo_agendada';
      if (estadoRaw.includes('cerrado') || estadoRaw.includes('exito')) pipeline_stage = 'cerrado';
      if (estadoRaw.includes('perdido') || estadoRaw.includes('rechaz')) pipeline_stage = 'perdido';

      const leadData = {
        contact_name,
        phone_whatsapp,
        email,
        business_name,
        city,
        orders_per_day,
        pipeline_stage,
        demo_scheduled_at: demo_date,
        source: 'otro', // Manual import
        imported_from_sheet: true,
        updated_at: new Date().toISOString(),
      };

      // Perform upsert by phone or email
      // We prioritize phone_whatsapp as unique identifier for leads in this logic
      const { data: lead, error: upsertError } = await supabase
        .from('leads')
        .upsert(leadData, { onConflict: 'phone_whatsapp' })
        .select()
        .single();

      if (!upsertError && lead) {
        importedCount++;
        // Log Activity
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          activity_type: 'other',
          description: 'Lead importado mediante carga manual de Excel/CSV',
        });
      } else if (upsertError) {
        console.error('[Import API] Upsert Error:', upsertError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Se importaron ${importedCount} leads correctamente`,
      imported: importedCount 
    });

  } catch (error: any) {
    console.error('[Import API] Crash:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500 });
  }
}
