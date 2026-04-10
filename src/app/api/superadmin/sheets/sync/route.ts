import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { GoogleSheetsSyncService } from "@/lib/integrations/google-sheets-api";

export async function POST(request: Request) {
  // Pure DB Mode: Disabling manual sync logic to avoid 500 errors and dependency on external sheets.
  // The system now consumes leads directly from 'leads' and 'landing_leads' tables.
  
  return NextResponse.json({ 
    message: "Manual synchronization is disabled in Pure DB Mode. Leads are now fetched directly from Supabase.",
    status: "disabled"
  });
}
