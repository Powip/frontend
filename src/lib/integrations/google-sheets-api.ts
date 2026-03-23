import { google } from "googleapis";
import { createClient } from "@/utils/supabase/server";

export class GoogleSheetsSyncService {
  private oauth2Client: any;
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  private async initializeAuth() {
    const { data: settings } = await this.supabase
      .from("integration_settings")
      .select("key, value")
      .in("key", [
        "google_oauth_client_id",
        "google_oauth_client_secret",
        "google_oauth_refresh_token"
      ]);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => (config[s.key] = s.value));

    if (!config.google_oauth_client_id || !config.google_oauth_client_secret || !config.google_oauth_refresh_token) {
      throw new Error("Missing Google OAuth2 credentials in integration_settings");
    }

    this.oauth2Client = new google.auth.OAuth2(
      config.google_oauth_client_id,
      config.google_oauth_client_secret
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.google_oauth_refresh_token
    });
  }

  async syncSheet(sheetId?: string) {
    await this.initializeAuth();
    
    // Get target Sheet ID from settings if not provided
    if (!sheetId) {
      const { data } = await this.supabase
        .from("integration_settings")
        .select("value")
        .eq("key", "google_sheet_id")
        .single();
      sheetId = data?.value;
    }

    if (!sheetId) throw new Error("No Google Sheet ID provided or configured");

    const sheets = google.sheets({ version: "v4", auth: this.oauth2Client });
    
    // Log start of sync
    const { data: logEntry } = await this.supabase
      .from("google_sync_logs")
      .insert({ sheet_id: sheetId, status: "pending" })
      .select()
      .single();

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: "Sheet1!A2:Z1000", // Adjust range as needed
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        await this.supabase
          .from("google_sync_logs")
          .update({ status: "success", rows_imported: 0, finished_at: new Date().toISOString() })
          .eq("id", logEntry.id);
        return { success: true, imported: 0 };
      }

      let importedCount = 0;
      for (const row of rows) {
        // Mapping Logic (Reusing Phase 1 structure)
        // Row[0]: sheet_row_id (required for upsert)
        // Row[1]: contact_name
        // Row[2]: business_name
        // Row[3]: phone_whatsapp
        // Row[4]: email
        const sheetRowId = row[0];
        if (!sheetRowId) continue;

        const { error: upsertError } = await this.supabase.from("leads").upsert({
          sheet_row_id: sheetRowId,
          contact_name: row[1] || "",
          business_name: row[2] || "",
          phone_whatsapp: row[3] || "",
          email: row[4] || "",
          pipeline_stage: "nuevo",
          source: "google_sheets",
          updated_at: new Date().toISOString()
        }, { onConflict: "sheet_row_id" });

        if (!upsertError) importedCount++;
      }

      await this.supabase
        .from("google_sync_logs")
        .update({ 
          status: "success", 
          rows_imported: importedCount, 
          finished_at: new Date().toISOString() 
        })
        .eq("id", logEntry.id);

      return { success: true, imported: importedCount };
    } catch (err: any) {
      console.error("[GoogleSheetsSync] Error:", err);
      await this.supabase
        .from("google_sync_logs")
        .update({ 
          status: "failed", 
          error_message: err.message, 
          finished_at: new Date().toISOString() 
        })
        .eq("id", logEntry.id);
      throw err;
    }
  }
}
