import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Mapping payload structure exactly as sent by the generic Google Apps Script
    // We expect the script to send a JSON with key-value pairs matching the columns.
    // Example: { "Submission ID": "abc", "Correo electrónico": "test@test.com", "Numero de Whatsapp": "123", ... }
    
    // Normalize keys to lowercase for easier matching, just in case
    const payloadKeys = Object.keys(body);
    const getVal = (possibleNames: string[]) => {
      for (const key of payloadKeys) {
        if (possibleNames.some(name => key.toLowerCase().includes(name.toLowerCase()))) {
          return body[key];
        }
      }
      return null;
    };

    const sheetRowId = getVal(['Submission ID', 'ID', 'row']);
    const contactName = getVal(['Datos de Contacto', 'Nombre', 'Name', 'Contacto']);
    const businessName = getVal(['Nombre de tu negocio', 'Empresa', 'Negocio', 'Business']);
    const phone = getVal(['Numero de Whatsapp', 'Whatsapp', 'Celular', 'Telefono', 'Phone']);
    const email = getVal(['Correo electrónico', 'Correo', 'Email']);
    
    // We assume 'nuevo' stage unless the form has an explicit 'ESTADO' column
    let stageStr = getVal(['ESTADO', 'Stage', 'Pipeline']) || 'nuevo';
    let stage = typeof stageStr === 'string' ? stageStr.toLowerCase() : 'nuevo';
    
    if (stage.includes('interesado') || stage.includes('propuesta')) {
       stage = 'evaluacion';
    } else if (stage === 'cerrado' || stage === 'alta') {
       stage = 'cerrado';
    } else {
       stage = 'nuevo'; // Fallback
    }

    if (!sheetRowId) {
      console.warn('[Google Webhook] Received payload without Submission ID:', body);
      return NextResponse.json({ error: 'Falta Submission ID o identificador único' }, { status: 400 });
    }

    const safeString = (val: any) => val ? String(val) : '';

    // Insert or update the lead
    const { data, error } = await supabase
      .from('leads')
      .upsert({
        sheet_row_id: String(sheetRowId),
        contact_name: safeString(contactName),
        business_name: safeString(businessName),
        phone_whatsapp: safeString(phone),
        email: safeString(email),
        source: 'google_form',
        pipeline_stage: stage,
        imported_from_sheet: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sheet_row_id' })
      .select()
      .single();

    if (error) {
      console.error('[Google Webhook] Upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Google Webhook] Successfully processed lead:', data.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Lead received and processed successfully',
      leadId: data.id 
    }, { status: 200 });

  } catch (err: any) {
    console.error('[Google Webhook] Global error:', err);
    return NextResponse.json({ error: 'Internal server error processing webhook' }, { status: 500 });
  }
}
