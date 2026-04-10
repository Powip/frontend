import axios from 'axios';

export interface Lead {
  id: string;
  contact_name: string;
  business_name: string;
  phone_whatsapp: string;
  email: string;
  business_type: string;
  source: 'instagram' | 'referido' | 'landing' | 'whatsapp' | 'google_form' | 'otro';
  pipeline_stage: string;
  plan_interest: string;
  orders_per_day?: number;
  courier?: string;
  interested_in?: string;
  assigned_to?: string;
  last_contact_at?: string;
  next_action?: string;
  next_action_date?: string;
  observations?: string;
  city?: string;
  comments?: string;
  created_at: string;
  updated_at: string;
  days_in_stage?: number;
  imported_from_sheet?: boolean;
}

export interface LeadActivation {
  id: string;
  lead_id: string;
  business_name: string;
  contact_name: string;
  plan: string;
  payment_received_at: string;
  activation_date: string;
  activation_status: string;
  integrations: string;
  training: string;
  assigned_to: string;
  observations: string;
  created_at: string;
  updated_at: string;
  lead?: Lead;
}

export interface LeadPostventa {
  id: string;
  lead_id: string;
  activation_id: string;
  business_name: string;
  activation_date: string;
  first_use_date: string;
  followup_7d: string;
  followup_30d: string;
  client_status: string;
  assigned_to: string;
  observations: string;
  created_at: string;
  updated_at: string;
  lead?: Lead;
  activation?: LeadActivation;
}

const getAuthConfig = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : {};

export const leadService = {
  // ─── Leads (CRM Comercial) ───
  getAllLeads: async (token?: string): Promise<Lead[]> => {
    const response = await axios.get('/api/superadmin/leads', getAuthConfig(token));
    return response.data.data;
  },

  updateLeadStage: async (id: string, newStage: string, oldStage: string, token?: string) => {
    const response = await axios.patch(
      `/api/superadmin/leads/${id}/stage`,
      { new_stage: newStage, old_stage: oldStage },
      getAuthConfig(token)
    );
    return response.data;
  },

  activateLead: async (id: string, token?: string) => {
    const response = await axios.post(
      `/api/superadmin/leads/${id}/activate`,
      {},
      getAuthConfig(token)
    );
    return response.data;
  },

  deleteLead: async (id: string, token?: string) => {
    const response = await axios.delete(
      `/api/superadmin/leads/${id}`,
      getAuthConfig(token)
    );
    return response.data;
  },

  updateLead: async (id: string, data: any, token?: string) => {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const response = await axios.patch(`/api/superadmin/leads/${id}`, data, config);
    return response.data;
  },

  updateBulkLeads: async (ids: string[], data: any, token?: string) => {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const response = await axios.patch(`/api/superadmin/leads/bulk`, { ids, data }, config);
    return response.data;
  },

  addActivity: async (id: string, activityType: string, description: string, token?: string) => {
    const response = await axios.post(
      `/api/superadmin/leads/${id}/activity`,
      { activity_type: activityType, description },
      getAuthConfig(token)
    );
    return response.data;
  },

  getLeadDetails: async (id: string, token?: string) => {
    const response = await axios.get(
      `/api/superadmin/leads/${id}`,
      getAuthConfig(token)
    );
    return response.data;
  },

  // (Removed duplicate updateLead method)

  // ─── Activaciones (Activación / Alta) ───
  getActivations: async (token?: string): Promise<LeadActivation[]> => {
    const response = await axios.get('/api/superadmin/leads/activations', getAuthConfig(token));
    return response.data.data;
  },

  createActivation: async (data: Partial<LeadActivation>, token?: string) => {
    const response = await axios.post(
      '/api/superadmin/leads/activations',
      data,
      getAuthConfig(token)
    );
    return response.data;
  },

  updateActivation: async (id: string, data: Partial<LeadActivation>, token?: string) => {
    const response = await axios.patch(
      `/api/superadmin/leads/activations/${id}`,
      data,
      getAuthConfig(token)
    );
    return response.data;
  },

  // ─── Postventa (Postventa / Acompañamiento) ───
  getPostventa: async (token?: string): Promise<LeadPostventa[]> => {
    const response = await axios.get('/api/superadmin/leads/postventa', getAuthConfig(token));
    return response.data.data;
  },

  updatePostventa: async (id: string, data: Partial<LeadPostventa>, token?: string) => {
    const response = await axios.patch(
      `/api/superadmin/leads/postventa/${id}`,
      data,
      getAuthConfig(token)
    );
    return response.data;
  },
};
