import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const normalizePhone = (phone: string) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9) return "+51" + digits;
  if (digits.startsWith("51") && digits.length === 11) return "+" + digits;
  if (digits.length > 0) return "+" + digits;
  return "";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    
    const {
      contact_name,
      business_name,
      phone_whatsapp: rawPhone,
      email,
      source = 'google_form',
      pipeline_stage = 'nuevo',
      plan_interest = 'basic',
      sheet_row_id,
      observations
    } = body;

    const phone_whatsapp = normalizePhone(rawPhone);

    if (!rawPhone) {
      return NextResponse.json(
        { error: 'phone_whatsapp is required' },
        { status: 400 }
      );
    }

    let existingLead = null;

    // 1. Try resolving by sheet_row_id first if provided
    if (sheet_row_id) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('sheet_row_id', sheet_row_id)
        .single();
      existingLead = data;
    }

    // 2. If no match by sheet_row_id, try resolving via normalized phone (fallback for Webhooks)
    if (!existingLead && phone_whatsapp) {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('phone_whatsapp', phone_whatsapp)
        .limit(1)
        .single();
      existingLead = data;
    }

    let resultData;
    let actionLog = '';

    if (existingLead) {
      // Setup payload for update
      const updatePayload: any = {
        updated_at: new Date().toISOString(),
      };
      
      // We only update non-empty webhook fields so we don't accidentally erase data
      if (contact_name) updatePayload.contact_name = contact_name;
      if (business_name) updatePayload.business_name = business_name;
      if (email) updatePayload.email = email;
      if (observations) updatePayload.observations = observations;
      if (sheet_row_id && !existingLead.sheet_row_id) {
        updatePayload.sheet_row_id = sheet_row_id;
      }
      
      const { data: updatedLead, error } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', existingLead.id)
        .select()
        .single();

      if (error) throw error;
      resultData = updatedLead;
      actionLog = 'Lead actualizado mediante Webhook';
    } else {
      // Create new lead
      const generateRowId = `webhook_${Date.now()}`;
      
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          contact_name,
          business_name,
          phone_whatsapp,
          email,
          source,
          pipeline_stage,
          plan_interest,
          sheet_row_id: sheet_row_id || generateRowId,
          imported_from_sheet: true,
          observations,
        })
        .select()
        .single();

      if (error) throw error;
      resultData = newLead;
      actionLog = 'Nuevo lead creado mediante Webhook';
    }

    // Register activity
    if (resultData) {
       await supabase.from("lead_activities").insert({
         lead_id: resultData.id,
         activity_type: "importado",
         description: `${actionLog}. Origen: ${source}. Tel: ${phone_whatsapp}`,
       });
    }

    return NextResponse.json(
      { message: actionLog, data: resultData },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Webhook] Unexpected error in lead import:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
