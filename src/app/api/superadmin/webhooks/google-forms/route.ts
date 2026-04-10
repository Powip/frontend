import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('X-Webhook-Secret');
    const SECRET = "powip_sheet_sync_2026"; 

    if (authHeader !== SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pure DB Mode: Webhook is now passive. 
    // We acknowledge the request to avoid errors on the sender (Google Apps Script), 
    // but we no longer process or store the data as the system now consumes DB tables directly.
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook received (Passive Mode). Pure DB Mode is active.' 
    });

  } catch (error: any) {
    console.error('[Google Webhook] Error:', error);
    return NextResponse.json({ success: true, message: 'Graceful ignore' });
  }
}
