import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { GoogleSheetsSyncService } from "@/lib/integrations/google-sheets-api";

export async function POST(request: Request) {
  const supabase = await createClient();
  const syncService = new GoogleSheetsSyncService(supabase);
  
  try {
    const body = await request.json().catch(() => ({}));
    const { sheet_id } = body;

    const result = await syncService.syncSheet(sheet_id);
    
    return NextResponse.json({ 
      message: "Sync triggered manually", 
      result 
    });
  } catch (err: any) {
    console.error("[ManualSync] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
