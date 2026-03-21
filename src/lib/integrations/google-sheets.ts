import { createClient } from "@/utils/supabase/server";

export async function syncLeadToGoogleSheets(leadId: string, newStage: string) {
  const supabase = await createClient();

  try {
    // 1. Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError) throw leadError;

    // 2. Log intent to webhook_logs (Architecture)
    // In a real production environment, this would call the Google Sheets API
    // or trigger an Edge Function that handles the OAuth2 flow.
    const { error: logError } = await supabase.from("webhook_logs").insert({
      source: "google_sheets",
      event_type: "lead_stage_updated",
      payload: {
        lead_id: leadId,
        contact_name: lead.contact_name,
        new_stage: newStage,
        sheet_row_id: lead.sheet_row_id,
        timestamp: new Date().toISOString()
      },
      status: "pending"
    });

    if (logError) throw logError;

    console.log(`[GoogleSheetsSync] Sync initiated for lead ${leadId} to stage ${newStage}`);
    
    // Simulate successful start of sync
    return { success: true };
  } catch (err: any) {
    console.error("[GoogleSheetsSync] Error initiating sync:", err);
    return { success: false, error: err.message };
  }
}
