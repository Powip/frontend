import { google } from "googleapis";
import { createClient } from "@/utils/supabase/server";

export class GoogleSheetsSyncService {
  private oauth2Client: any;
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  private isAuthenticated = false;

  private async initializeAuth() {
    try {
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

      if (config.google_oauth_client_id && config.google_oauth_client_secret && config.google_oauth_refresh_token) {
        this.oauth2Client = new google.auth.OAuth2(
          config.google_oauth_client_id,
          config.google_oauth_client_secret
        );

        this.oauth2Client.setCredentials({
          refresh_token: config.google_oauth_refresh_token
        });
        
        this.isAuthenticated = true;
      }
    } catch (err) {
      console.warn("[Sync] Auth initialization failed, falling back to public fetch:", err);
      this.isAuthenticated = false;
    }
  }

  private async fetchPublicCsv(spreadsheetId: string): Promise<string[][]> {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("No se pudo acceder a la hoja. Asegúrate de que el acceso sea 'Cualquier persona con el enlace' (Lector).");
    }

    const text = await response.text();
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Robust CSV split: Split by comma but only if NOT inside quotes
      // and DO NOT split on spaces (like in dates)
      const currentRawRow = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const cleanRow = currentRawRow.map(cell => 
        cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
      );
      
      rows.push(cleanRow);
    }

    // Return rows excluding header
    return rows.slice(1);
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
    
    // Log start of sync
    const { data: logEntry } = await this.supabase
      .from("google_sync_logs")
      .insert({ sheet_id: sheetId, status: "pending" })
      .select()
      .single();

    try {
      let rows: any[] = [];

      if (this.isAuthenticated) {
        const sheets = google.sheets({ version: "v4", auth: this.oauth2Client });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A2:Z1000",
        });
        rows = response.data.values || [];
      } else {
        // Fallback: Public CSV Export
        rows = await this.fetchPublicCsv(sheetId);
      }
      if (!rows || rows.length === 0) {
        await this.supabase
          .from("google_sync_logs")
          .update({ status: "success", rows_imported: 0, finished_at: new Date().toISOString() })
          .eq("id", logEntry.id);
        return { success: true, imported: 0 };
      }

      let importedCount = 0;
      const safeString = (val: any) => (val ? String(val).trim() : "");
      
      const normalizePhone = (phone: string) => {
        // Clean special characters like ( ) - or whitespace or "
        const digits = phone.replace(/\D/g, "");
        if (digits.length === 9) return "+51" + digits;
        if (digits.startsWith("51") && digits.length === 11) return "+" + digits;
        if (digits.length > 0) return "+" + digits;
        return "";
      };


      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Revised Mapping for "Form Responses" Sheet based on user feedback and CSV inspection:
        // Col D (3): contact_name
        // Col J (9): business_name
        // Col F (5): phone_whatsapp
        // Col G (6): email
        // Col V (21) or Col S (18): plan_interest (based on CSV inspection)
        
        const contactName = safeString(row[3]);
        const businessName = safeString(row[9]);
        const phoneRaw = safeString(row[5]);
        const email = safeString(row[6]);
        const planInterestRaw = safeString(row[18] || row[21]).toLowerCase(); // Adaptable based on CSV
        const sourceRaw = "google_form"; // Default for this sheet
        
        // Validation: Required Fields
        if (!contactName || !phoneRaw) {
          console.warn(`[Sync] Skipping row ${i + 1}: Missing name or phone`);
          continue;
        }

        const sheetRowId = `row_${i + 2}`;
        
        // Normalizar WhatsApp
        const phone_whatsapp = normalizePhone(phoneRaw);

        // Debug log for troubleshooting misalignments
        console.log(`[Sync] Row ${i}: Name=${contactName}, Business=${businessName}, Phone=${phone_whatsapp}`);

        // Mapear Origen
        const sourceMapping: Record<string, string> = {
          'ig': 'instagram',
          'instagram': 'instagram',
          'wa': 'whatsapp',
          'whatsapp': 'whatsapp',
          'landing': 'landing',
          'referido': 'referido',
          'google': 'google_form',
          'form': 'google_form'
        };
        const source = sourceMapping[sourceRaw.toLowerCase()] || 'otro';

        // Mapear Plan de Interés (opcional, para asegurar coincidencia con enum si existiera)
        let plan_interest = 'basic';
        if (planInterestRaw.includes('standard')) plan_interest = 'standard';
        else if (planInterestRaw.includes('full')) plan_interest = 'full';
        else if (planInterestRaw.includes('enterprise')) plan_interest = 'enterprise';
        else if (planInterestRaw.includes('basic')) plan_interest = 'basic';

        // State Preservation: Only set to 'nuevo' if the lead doesn't exist yet
        const { data: existingLead } = await this.supabase
          .from("leads")
          .select("pipeline_stage")
          .eq("sheet_row_id", sheetRowId)
          .single();

        const pipelineStage = existingLead ? existingLead.pipeline_stage : "nuevo";

        // Upsert Lead
        const { data: lead, error: upsertError } = await this.supabase
          .from("leads")
          .upsert({
            sheet_row_id: sheetRowId,
            contact_name: contactName,
            business_name: businessName,
            phone_whatsapp,
            email,
            plan_interest,
            source: "google_form",
            pipeline_stage: pipelineStage,
            imported_from_sheet: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'sheet_row_id'
          })
          .select()
          .single();

        if (upsertError) {
          console.error(`[Sync] Error upserting row ${i + 1}:`, upsertError);
          continue;
        }

        if (lead) {
          importedCount++;
          
          // Registrar actividad
          await this.supabase.from("lead_activities").insert({
            lead_id: lead.id,
            activity_type: "importado",
            description: `Lead importado/actualizado desde Google Sheets (Fila ${i + 1}). Email: ${email}, Plan: ${plan_interest}`,
          });
        }
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
