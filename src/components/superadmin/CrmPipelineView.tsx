'use client';

import React, { useState } from 'react';
import { LayoutGrid, List, Download, Plus, GitBranch, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CrmPipelineKpis } from './CrmPipelineKpis';
import { LeadsKanban } from './LeadsKanban';
import { LeadsTable } from './LeadsTable';
import { CreateLeadModal } from './CreateLeadModal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CrmPipelineViewProps {
  leads: any[];
  token?: string;
  isLoading?: boolean;
}

export const CrmPipelineView: React.FC<CrmPipelineViewProps> = ({
  leads,
  token,
  isLoading,
}) => {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/superadmin/sheets/sync', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({}) // Trigger default sheet sync
      });
      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || 'Error en sincronización');
      
      toast.success(`${result.result?.imported || 0} leads sincronizados desde Sheets`);
      
      // Delay to show toast before refreshing
      setTimeout(() => {
        window.location.reload(); 
      }, 1500);
      
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      toast.error(error.message || 'Error al conectar con Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-muted-foreground animate-pulse gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-500">Cargando pipeline...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Pipeline CRM
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">
            Ciclo comercial: Lead → Cliente activo
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 rounded-lg">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all duration-200",
                view === 'kanban'
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setView('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all duration-200",
                view === 'table'
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <List className="h-3.5 w-3.5" />
              Tabla
            </button>
          </div>

          {/* Sync Sheets */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2 h-9 border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/10 text-[11px] font-bold uppercase tracking-wider"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white text-[11px] font-bold uppercase tracking-wider"
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

      {/* Board */}
      <div className="mt-2">
        {view === 'kanban' ? (
          <LeadsKanban initialLeads={leads} token={token} />
        ) : (
          <LeadsTable leads={leads} token={token} />
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
