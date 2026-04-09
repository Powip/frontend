'use client';

import React, { useState } from 'react';
import {
  Download, Plus, RefreshCw,
  Briefcase, Rocket, HeartHandshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CrmPipelineKpis } from './CrmPipelineKpis';
import { CrmComercialTable } from './CrmComercialTable';
import { ActivacionTable } from './ActivacionTable';
import { PostventaTable } from './PostventaTable';
import { CreateLeadModal } from './CreateLeadModal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useLeadActivations, useLeadPostventa, useCreateActivation } from '@/hooks/useLeads';

interface CrmPipelineViewProps {
  leads: any[];
  token?: string;
  isLoading?: boolean;
  auth?: any;
  plans?: any[];
}

const MAIN_TABS = [
  { id: 'comercial', label: 'CRM Comercial', icon: Briefcase, description: 'Leads y pipeline de ventas' },
  { id: 'activacion', label: 'Activación / Alta', icon: Rocket, description: 'Onboarding de nuevos clientes' },
  { id: 'postventa', label: 'Postventa / Seguimiento', icon: HeartHandshake, description: 'Acompañamiento y retención' },
];

export const CrmPipelineView: React.FC<CrmPipelineViewProps> = ({
  leads,
  token,
  isLoading,
  auth,
  plans = [],
}) => {
  const [activeTab, setActiveTab] = useState('comercial');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  // Fetch activations and postventa data
  const { data: activations = [], refetch: refetchActivations } = useLeadActivations(token);
  const { data: postventa = [], refetch: refetchPostventa } = useLeadPostventa(token);
  const createActivation = useCreateActivation(token);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/superadmin/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Error en sincronización');

      toast.success(`${result.result?.imported || 0} leads sincronizados desde Sheets`);

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      toast.error(error.message || 'Error al conectar con Google Sheets. Si estás en Producción, verifica las variables de entorno.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMoveToPago = async (lead: any) => {
    try {
      await createActivation.mutateAsync({
        lead_id: lead.id,
        business_name: lead.business_name,
        contact_name: lead.contact_name,
        plan: lead.plan_interest,
        assigned_to: lead.assigned_to,
      });
      toast.success('Lead movido a Activación / Alta');
      refetchActivations();
    } catch (error: any) {
      // If it already exists, that's fine
      if (error?.response?.status === 409) {
        toast.info('Ya existe un registro de activación para este lead');
      } else {
        toast.error('Error al crear registro de activación');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground animate-pulse gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-500">Cargando CRM...</span>
      </div>
    );
  }

  // If we are actively syncing, we show a full overlay on top of the content
  // so the user knows we are performing the extraction from Google Sheets
  const SyncOverlay = () => (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-sm animate-in fade-in">
      <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl border border-primary/20">
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
        <div className="text-center">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Sincronizando con Google Sheets</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 max-w-xs">
            Extrayendo la información más reciente desde la hoja de cálculo y cruzando duplicados...
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative">
      {isSyncing && <SyncOverlay />}
      {/* Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            CRM Leads
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
            Ciclo comercial completo: Lead → Venta → Activación → Cliente
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sync Sheets */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2 h-9 border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/10 text-[11px] font-bold uppercase tracking-wider"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 text-[11px] font-bold uppercase tracking-wider"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar
          </Button>

          {/* New Lead */}
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="gap-2 h-9 bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo Lead
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <CrmPipelineKpis leads={leads} token={token} />

      {/* Main Tabs — 3 stages */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex gap-0">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            // Count items per tab
            let count = 0;
            if (tab.id === 'comercial') count = leads.filter(l => l.pipeline_stage !== 'pago_recibido').length;
            if (tab.id === 'activacion') count = activations.filter((a: any) => a.activation_status !== 'alta_completa').length;
            if (tab.id === 'postventa') count = postventa.length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2.5 px-5 py-3.5 text-sm font-bold transition-all border-b-2',
                  isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-slate-400')} />
                <span className="whitespace-nowrap">{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black',
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        {activeTab === 'comercial' && (
          <CrmComercialTable
            leads={leads}
            token={token}
            onStageChange={() => {
              refetchActivations();
            }}
            onMoveToPago={handleMoveToPago}
          />
        )}

        {activeTab === 'activacion' && (
          <ActivacionTable
            activations={activations}
            token={token}
            auth={auth}
            plans={plans}
            onUpdateStatus={() => {
              refetchActivations();
              refetchPostventa();
            }}
          />
        )}

        {activeTab === 'postventa' && (
          <PostventaTable
            postventa={postventa}
            token={token}
            onUpdateStatus={() => {
              refetchPostventa();
            }}
          />
        )}
      </div>

      <CreateLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          toast.success('Lead creado correctamente');
          setTimeout(() => window.location.reload(), 1000);
        }}
        token={token}
      />
    </div>
  );
};
