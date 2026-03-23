import axios from 'axios';

export interface Lead {
  id: string;
  contact_name: string;
  business_name: string;
  phone_whatsapp: string;
  email: string;
  business_type: string;
  source: 'instagram' | 'referido' | 'landing' | 'whatsapp' | 'otro';
  pipeline_stage: 'nuevo' | 'contactado' | 'demo_agendada' | 'demo_realizada' | 'evaluacion' | 'cerrado' | 'perdido';
  plan_interest: 'basic' | 'standard' | 'full' | 'enterprise';
  created_at: string;
  updated_at: string;
  last_contact_at?: string;
  days_in_stage?: number;
}

export const leadService = {
  getAllLeads: async (token?: string): Promise<Lead[]> => {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const response = await axios.get('/api/superadmin/leads', config);
    return response.data.data;
  },

  updateLeadStage: async (id: string, newStage: string, oldStage: string, token?: string) => {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const response = await axios.patch(`/api/superadmin/leads/${id}/stage`, {
      new_stage: newStage,
      old_stage: oldStage
    }, config);
    return response.data;
  },

  activateLead: async (id: string, token?: string) => {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const response = await axios.post(`/api/superadmin/leads/${id}/activate`, {}, config);
    return response.data;
  }
};
