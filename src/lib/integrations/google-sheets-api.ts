import { google } from "googleapis";

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
      console.warn("[GoogleSheetsSync] Auth initialization failed:", err);
      this.isAuthenticated = false;
    }
  }

  private async fetchPublicCsv(spreadsheetId: string): Promise<string[][]> {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`No se pudo acceder a la hoja (HTTP ${response.status}). Verifica el acceso público.`);
    }

    const text = await response.text();
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const currentRawRow = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const cleanRow = currentRawRow.map(cell => 
        cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
      );
      rows.push(cleanRow);
    }
    return rows;
  }

  async syncSheet(sheetId?: string) {
    await this.initializeAuth();
    
    if (!sheetId) {
      const { data } = await this.supabase
        .from("integration_settings")
        .select("value")
        .eq("key", "google_sheet_id")
        .single();
      sheetId = data?.value;
    }

    if (!sheetId) throw new Error("No Google Sheet ID configurado");
    
    try {
      let rows: any[] = [];

      if (this.isAuthenticated) {
        const sheets = google.sheets({ version: "v4", auth: this.oauth2Client });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A1:Z1000",
        });
        rows = response.data.values || [];
      } else {
        rows = await this.fetchPublicCsv(sheetId);
      }
      
      if (!rows || rows.length <= 1) return { success: true, imported: 0 };

      const headers = rows[0].map((h: string) => (h || "").toLowerCase().trim());
      const findIdx = (keywords: string[]) => headers.findIndex((h: string) => keywords.some(k => h.includes(k)));

      const idx = {
        contact: findIdx(["datos de contacto", "nombre de contacto", "vendedor"]),
        phone: findIdx(["numero de whatsapp", "whatsapp", "teléfono"]),
        email: findIdx(["correo electrónico", "email", "mail"]),
        business: findIdx(["nombre de tu negocio", "negocio", "empresa"]),
        city: findIdx(["departamento", "ciudad"]),
        orders: findIdx(["cuantos pedidos diarios", "pedidos"]),
        estado: findIdx(["estado"]),
        demo: findIdx(["fecha demo", "demo"])
      };

      // Exact Mapping Fallbacks (User provided structure)
      if (idx.contact === -1) idx.contact = 0;
      if (idx.phone === -1) idx.phone = 2;
      if (idx.email === -1) idx.email = 3;
      if (idx.business === -1) idx.business = 6;
      if (idx.city === -1) idx.city = 8;
      if (idx.orders === -1) idx.orders = 13;
      if (idx.estado === -1) idx.estado = 18;
      if (idx.demo === -1) idx.demo = 19;

      let importedCount = 0;
      const normalizePhone = (p: any) => {
        const s = String(p || "").replace(/\D/g, "");
        if (s.length === 9) return "+51" + s;
        if (s.startsWith("51") && s.length === 11) return "+" + s;
        return s ? "+" + s : "";
      };

      const parseOrders = (v: any) => {
        const m = String(v || "").match(/\d+/);
        return m ? parseInt(m[0]) : null;
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const phone = normalizePhone(row[idx.phone]);
        const email = String(row[idx.email] || "").trim();
        const contact = String(row[idx.contact] || "").trim();
        const business = String(row[idx.business] || "").trim();
        const city = String(row[idx.city] || "").trim();
        const orders = parseOrders(row[idx.orders]);
        const estadoRaw = String(row[idx.estado] || "").toLowerCase();

        if (!phone && !email) continue;

        let stage = "nuevo";
        if (estadoRaw.includes("contact")) stage = "contactado";
        if (estadoRaw.includes("demo") || estadoRaw.includes("agend")) stage = "demo_agendada";
        if (estadoRaw.includes("cerrado") || estadoRaw.includes("exito")) stage = "cerrado";
        if (estadoRaw.includes("perdido") || estadoRaw.includes("rechaz")) stage = "perdido";

        const leadData = {
          contact_name: contact,
          business_name: business,
          phone_whatsapp: phone,
          email: email,
          city,
          orders_per_day: orders,
          pipeline_stage: stage,
          source: "sheets",
          imported_from_sheet: true,
          updated_at: new Date().toISOString()
        };

        const { error } = await this.supabase
          .from("leads")
          .upsert(leadData, { onConflict: "phone_whatsapp" });

        if (!error) importedCount++;
      }

      return { success: true, imported: importedCount };
    } catch (err: any) {
      console.error("[GoogleSheetsSync] Error:", err);
      throw err;
    }
  }
}
