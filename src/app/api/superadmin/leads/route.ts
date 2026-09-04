import { NextResponse } from 'next/server';
import { createAdminClient as createClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const stage = searchParams.get('stage');
    const source = searchParams.get('source');
    const assignedTo = searchParams.get('assigned_to');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10); // Límite normal paginado
    const offset = (page - 1) * limit;

    // 1. Consulta directo a la vista unificada
    let query = supabase
      .from('v_all_leads')
      .select('*', { count: 'exact' });

    // 2. Aplicar filtros dinámicos en Postgres
    if (stage) query = query.eq('pipeline_stage', stage);
    if (source) query = query.eq('source', source);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (search) {
      query = query.or(
        `contact_name.ilike.%${search}%,business_name.ilike.%${search}%,email.ilike.%${search}%,phone_whatsapp.ilike.%${search}%`
      );
    }

    // 3. Paginación nativa en Base de Datos (O(1) en memoria serverless)
    const { data: leads, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Leads API] DB Error:', error);
      return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }

    const totalRecords = count || 0;

    return NextResponse.json({
      data: leads || [],
      pagination: {
        page,
        limit,
        total: totalRecords,
        total_pages: Math.ceil(totalRecords / limit)
      }
    });

  } catch (error: any) {
    console.error('[Leads API] Crash:', error);
    return NextResponse.json({ data: [], error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      contact_name,
      business_name,
      phone_whatsapp,
      email,
      source
    } = body;

    if (!contact_name || !phone_whatsapp) {
      return NextResponse.json(
        { error: 'Name and Phone are required' },
        { status: 400 }
      );
    }

    // 1. Verificación de duplicado por Teléfono o Email en la tabla 'leads'
    let checkQuery = `phone_whatsapp.eq.${phone_whatsapp}`;
    if (email) checkQuery += `,email.eq.${email}`;

    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, contact_name, phone_whatsapp')
      .or(checkQuery)
      .maybeSingle();

    if (existingLead) {
      return NextResponse.json(
        { 
          error: 'Ya existe un lead registrado con este número de teléfono o correo.',
          existingLead 
        },
        { status: 409 } // HTTP 409 Conflict
      );
    }

    // 2. Creación del Lead si no hay duplicados
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        contact_name,
        business_name,
        phone_whatsapp,
        email,
        source: source || 'otro',
        pipeline_stage: 'nuevo',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Registrar actividad inicial
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'other',
      description: 'Lead creado manualmente',
    });

    return NextResponse.json(
      { message: 'Lead created successfully', data: lead },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Unexpected error in lead creation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}