import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { GoogleSheetsSyncService } from "@/lib/integrations/google-sheets-api";

export async function POST() {
  const supabase = await createClient();
  const syncService = new GoogleSheetsSyncService(supabase);
  
  try {
    const result = await syncService.syncSheet();
    
    return NextResponse.json({ 
      message: "Periodic sync completed", 
      result 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
