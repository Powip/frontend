import { google } from "googleapis";
import { createClient } from "@/utils/supabase/server";

export class GoogleSheetsSyncService {
  private oauth2Client: any;
  private supabase: any;
  private isAuthenticated = false;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

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

      // Detailed Environment Logging for Production diagnosis
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd) {
        console.log(`[GoogleSheetsSync] Production init: ClientID Exists: ${!!config.google_oauth_client_id}, Secret Exists: ${!!config.google_oauth_client_secret}`);
      }

      if (config.google_oauth_client_id && config.google_oauth_client_secret && config.google_oauth_refresh_token) {
        this.oauth2Client = new google.auth.OAuth2(
          config.google_oauth_client_id,
          config.google_oauth_client_secret
        );

        this.oauth2Client.setCredentials({
          refresh_token: config.google_oauth_refresh_token
        });
        
        this.isAuthenticated = true;
      } else {
        if (isProd) {
           console.warn(`[GoogleSheetsSync] Missing Auth variables in integration_settings table in Production.`);
        }
      }
    } catch (err) {
      console.warn("[GoogleSheetsSync] Auth initialization failed, falling back to public fetch:", err);
      this.isAuthenticated = false;
    }
  }

  private async fetchPublicCsv(spreadsheetId: string): Promise<string[][]> {
    if (!spreadsheetId) {
       throw new Error("No Google Sheet ID provided or configured");
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Public CSV Error (HTTP ${response.status}): No se pudo acceder a la hoja. Asegúrate de que el acceso sea 'Cualquier persona con el enlace' (Lector).`);
    }

    const text = await response.text();
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      // Robust CSV split
      const currentRawRow = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const cleanRow = currentRawRow.map(cell => 
        cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
      );
      rows.push(cleanRow);
    }

    // Return all rows including header for dynamic mapping
    return rows;
  }

  async syncSheet(sheetId?: string) {
    await this.initializeAuth();
    
    // Fallback to reading ID directly from DB if not provided
    if (!sheetId) {
      const { data } = await this.supabase
        .from("integration_settings")
        .select("value")
        .eq("key", "google_sheet_id")
        .single();
      sheetId = data?.value;
    }

    if (!sheetId) throw new Error("No Google Sheet ID provided or configured en integration_settings");
    
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
          range: "Sheet1!A1:Z1000", // Start from A1 to get headers
        });
        rows = response.data.values || [];
      } else {
        // Fallback: Public CSV Export
        console.log(`[GoogleSheetsSync] Reverting to CSV Fallback for Sheet: ${sheetId}`);
        rows = await this.fetchPublicCsv(sheetId);
      }
      
      if (!rows || rows.length <= 1) {
        await this.supabase
          .from("google_sync_logs")
          .update({ status: "success", rows_imported: 0, finished_at: new Date().toISOString() })
          .eq("id", logEntry?.id);
        return { success: true, imported: 0 };
      }

      // 1. Dynamic Header Mapping
      const headers = rows[0].map((h: string) => (h || "").toLowerCase().trim());
      const findIndex = (keywords: string[]) => {
        return headers.findIndex((h: string) => keywords.some(k => h.includes(k)));
      };

      const idx = {
        contact: findIndex(["nombre de contacto", "nombre completo", "vendedor", "persona", "quien"]),
        business: findIndex(["nombre del negocio", "nombre de empresa", "negocio", "empresa", "compañia", "sociedad", "marca"]),
        phone: findIndex(["whatsapp", "teléfono", "celular", "movil", "phone", "numero"]),
        email: findIndex(["correo electronico", "email", "mail", "gmail"]),
        interest: findIndex(["interes en", "servicio", "que le importa"]),
        plan: findIndex(["plan", "suscripcion"]),
        orders: findIndex(["pedidos diarios", "pedidos", "cantidad", "cuantos", "ped/diario"]),
        city: findIndex(["ciudad", "ubicación", "distrito", "provincia"]),
        courier: findIndex(["courier", "mensajeria", "envios"]),
        obs: findIndex(["observaciones", "comentarios", "notas"])
      };

      // Secon pass fallback if some critical indices weren't found
      if (idx.contact === -1) idx.contact = findIndex(["nombre", "contacto", "full name"]);
      if (idx.business === -1) idx.business = findIndex(["negocio", "empresa"]);
      if (idx.email === -1) idx.email = findIndex(["correo", "mail"]);
      if (idx.phone === -1) idx.phone = findIndex(["whatsapp", "tel"]);
      if (idx.orders === -1) idx.orders = findIndex(["cuantos pedidos"]);

      console.log("[GoogleSheetsSync] Header indices detected:", idx);

      let importedCount = 0;
      const safeString = (val: any) => (val ? String(val).trim() : "");
      
      const normalizePhone = (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length === 9) return "+51" + digits;
        if (digits.startsWith("51") && digits.length === 11) return "+" + digits;
        if (digits.length > 0) return "+" + digits;
        return "";
      };

      const parseOrders = (val: any) => {
        const s = safeString(val);
        if (!s) return null;
        const match = s.match(/\d+/);
        return match ? parseInt(match[0]) : null;
      };

      // Start processing from row 1 (skipping header)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        
        const contactName = idx.contact !== -1 ? safeString(row[idx.contact]) : "";
        const businessName = idx.business !== -1 ? safeString(row[idx.business]) : "";
        const phoneRaw = idx.phone !== -1 ? safeString(row[idx.phone]) : "";
        const email = idx.email !== -1 ? safeString(row[idx.email]) : "";
        const interestedIn = idx.interest !== -1 ? safeString(row[idx.interest]) : "";
        const planInterestRaw = idx.plan !== -1 ? safeString(row[idx.plan])?.toLowerCase() : "basic";
        const ordersPerDay = idx.orders !== -1 ? parseOrders(row[idx.orders]) : null;
        const city = idx.city !== -1 ? safeString(row[idx.city]) : "";
        const courier = idx.courier !== -1 ? safeString(row[idx.courier]) : "";
        const observations = idx.obs !== -1 ? safeString(row[idx.obs]) : "";

        // Validation: Required Fields
        if (!contactName || !phoneRaw) {
          console.warn(`[GoogleSheetsSync] Skipping row ${i}: Missing expected contactName or phone.`);
          continue;
        }

        const sheetRowId = `row_${i + 1}`; // Header is row 0, so row 1 is data index 1
        const phone_whatsapp = normalizePhone(phoneRaw);

        // State Preservation
        const { data: existingLead } = await this.supabase
          .from("leads")
          .select("pipeline_stage")
          .eq("sheet_row_id", sheetRowId)
          .single();

        const pipelineStage = existingLead ? existingLead.pipeline_stage : "nuevo";

        const validPlans = ["basic", "standard", "full", "enterprise"];
        const plan_interest = validPlans.includes(planInterestRaw || "") ? planInterestRaw : "basic";

        // Upsert Lead
        const { data: lead, error: upsertError } = await this.supabase
          .from("leads")
          .upsert({
            sheet_row_id: sheetRowId,
            contact_name: contactName,
            business_name: businessName,
            phone_whatsapp,
            email: email, 
            plan_interest: plan_interest,
            interested_in: interestedIn,
            orders_per_day: ordersPerDay,
            city: city,
            courier: courier,
            observations: observations,
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
           // We might hit a unique phone_whatsapp constraint without sheet_row_id clash
           if (upsertError.code === '23505') {
              // Phone whatsapp unique constraint error, we can try to update by phone instead
              const { data: phoneMatch } = await this.supabase
                .from('leads')
                .select('id, pipeline_stage')
                .eq('phone_whatsapp', phone_whatsapp)
                .single();
              
              if (phoneMatch) {
                 await this.supabase.from('leads').update({
                   contact_name: contactName,
                   business_name: businessName,
                   email: email,
                   plan_interest: plan_interest,
                   interested_in: interestedIn,
                   orders_per_day: ordersPerDay,
                   city: city,
                   courier: courier,
                   observations: observations,
                   sheet_row_id: sheetRowId, // Link this row to the existing lead
                   updated_at: new Date().toISOString()
                 }).eq('id', phoneMatch.id);
                 importedCount++;
                 continue;
              }
           }
           console.error(`[GoogleSheetsSync] Error upserting row ${i + 1}:`, upsertError);
           continue;
        }

        if (lead) {
          importedCount++;
          if (!existingLead) {
             // Registrar actividad only if created newly or first time imported
             await this.supabase.from("lead_activities").insert({
               lead_id: lead.id,
               activity_type: "importado",
               description: `Lead importado desde Google Sheets (Fila ${i + 1}).`,
             });
          }
        }
      }

      await this.supabase
        .from("google_sync_logs")
        .update({ 
          status: "success", 
          rows_imported: importedCount, 
          finished_at: new Date().toISOString() 
        })
        .eq("id", logEntry?.id);

      return { success: true, imported: importedCount };
    } catch (err: any) {
      console.error("[GoogleSheetsSync] Complete Error Sequence:", err);
      if (logEntry?.id) {
         await this.supabase
          .from("google_sync_logs")
          .update({ 
            status: "failed", 
            error_message: err.message, 
            finished_at: new Date().toISOString() 
          })
          .eq("id", logEntry.id);
      }
      throw err;
    }
  }
}
