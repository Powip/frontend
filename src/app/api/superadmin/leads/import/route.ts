import { NextResponse } from 'next/server';
import { createAdminClient as createClient } from '@/utils/supabase/admin';
import * as XLSX from 'xlsx';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Read as JSON with headers to make mapping more robust
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (!rows || rows.length <= 1) {
      return NextResponse.json({ error: 'El archivo está vacío o no tiene datos' }, { status: 400 });
    }

    const dataRows = rows.slice(1);
    const validLeads: any[] = [];
    const errors: string[] = [];
    let failedCount = 0;

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

    // 1. Map and Validate rows for bulk upsert
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length === 0) continue;

      const contact_name = String(row[0] || '').trim();
      const phone_whatsapp = normalizePhone(row[2]);
      
      if (!contact_name || !phone_whatsapp || phone_whatsapp.length < 5) {
        failedCount++;
        errors.push(`Fila ${i+2}: Nombre o Teléfono faltante/inválido`);
        continue;
      }

      const email = String(row[3] || '').trim();
      const business_name = String(row[6] || '').trim();
      const city = String(row[8] || '').trim();
      const orders_per_day = parseOrders(row[13]);
      const estadoRaw = String(row[18] || '').toLowerCase();
      const demo_date = parseDate(row[19]);

      let pipeline_stage = 'nuevo';
      if (estadoRaw.includes('contact')) pipeline_stage = 'contactado';
      if (estadoRaw.includes('demo') || estadoRaw.includes('agend')) pipeline_stage = 'demo_agendada';
      if (estadoRaw.includes('cerrado') || estadoRaw.includes('exito')) pipeline_stage = 'cerrado';
      if (estadoRaw.includes('perdido') || estadoRaw.includes('rechaz')) pipeline_stage = 'perdido';

      validLeads.push({
        contact_name,
        phone_whatsapp,
        email: email || null,
        business_name: business_name || null,
        pipeline_stage,
        source: 'otro',
        updated_at: new Date().toISOString(),
      });
    }

    if (validLeads.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No se encontraron registros válidos para importar',
        details: errors.slice(0, 10)
      }, { status: 400 });
    }

    // 2. Perform Bulk Upsert
    const { data: upsertedData, error: upsertError } = await supabase
      .from('leads')
      .upsert(validLeads, { onConflict: 'phone_whatsapp' })
      .select('id');

    if (upsertError) {
      console.error('[Import API] Bulk Upsert Error:', upsertError);
      return NextResponse.json({ 
        error: 'Error al persistir los datos en la base de datos', 
        details: upsertError.message 
      }, { status: 500 });
    }

    // 3. Log bulk activity (best effort, don't fail if lead_activities doesn't exist)
    if (upsertedData && upsertedData.length > 0) {
      try {
        const activities = upsertedData.map(lead => ({
          lead_id: lead.id,
          activity_type: 'other',
          description: `Lead importado mediante carga manual de Excel (${validLeads.length} total)`,
        }));

        const chunkSize = 50;
        for (let i = 0; i < activities.length; i += chunkSize) {
          await supabase.from('lead_activities').insert(activities.slice(i, i + chunkSize));
        }
      } catch (actErr) {
        console.warn('[Import API] Activity logging failed (non-critical):', actErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Importación completada con éxito.`,
      imported: upsertedData?.length || 0,
      failed: failedCount,
      errors: errors.slice(0, 5)
    });

  } catch (error: any) {
    console.error('[Import API] Critical Crash:', error);
    return NextResponse.json({ 
      error: 'Error crítico en el servidor', 
      details: error.message
    }, { status: 500 });
  }
}


