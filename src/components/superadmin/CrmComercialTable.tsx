'use client';

import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search, FilterX, MoreVertical, Mail, Phone, ExternalLink,
  History, Trash2, ChevronLeft, ChevronRight, Loader2, ArrowRightCircle, Users, CheckSquare, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LeadDetailsModal } from './LeadDetailsModal';
import { LeadActivitiesDrawer } from './LeadActivitiesDrawer';
import { leadService } from '@/services/leadService';
import { useRouter } from 'next/navigation';
import { StatusBadge, CRM_COMERCIAL_STATES, getStatusLabel } from './StatusBadge';
import { useUpdateBulkLeads } from '@/hooks/useLeads';
import { Checkbox } from '@/components/ui/checkbox';

interface CrmComercialTableProps {
  leads: any[];
  onStageChange?: (leadId: string, newStage: string, oldStage: string) => void;
  onMoveToPago?: (lead: any) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  landing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  referido: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  google_form: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
};

export const CrmComercialTable: React.FC<CrmComercialTableProps> = ({
  leads,
  onStageChange,
  onMoveToPago,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Mass update state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [massStage, setMassStage] = useState<string>('');
  const [massAssignedTo, setMassAssignedTo] = useState<string>('');
  
  const bulkUpdateMutation = useUpdateBulkLeads();
  const itemsPerPage = 10;
  const router = useRouter();

  // Filter leads: exclude pago_recibido (they move to Activación)
  const commercialLeads = leads.filter(l => {
    const stage = l.pipeline_stage || 'nuevo';
    return stage !== 'pago_recibido';
  });

  const filteredLeads = commercialLeads.filter(lead => {
    const matchesSearch =
      lead.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone_whatsapp?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage = stageFilter === 'all' || lead.pipeline_stage === stageFilter || (stageFilter === 'nuevo' && !lead.pipeline_stage);
    const matchesSource = sourceFilter === 'all' || lead.source?.toLowerCase() === sourceFilter;

    return matchesSearch && matchesStage && matchesSource;
  });

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleOpenDetails = (lead: any) => {
    setSelectedLead(lead);
    setIsDetailsOpen(true);
  };

  const handleOpenActivities = (lead: any) => {
    setSelectedLead(lead);
    setIsActivitiesOpen(true);
  };

  const handleDeleteLead = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este prospecto?')) return;

    setIsDeleting(id);
    try {
      await leadService.deleteLead(id);
      toast.success('Lead eliminado correctamente');
      router.refresh();
      setSelectedLeads(prev => prev.filter(selectedId => selectedId !== id));
    } catch {
      toast.error('Error al eliminar lead');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleStageChange = async (leadId: string, newStage: string, oldStage: string) => {
    try {
      await leadService.updateLeadStage(leadId, newStage, oldStage);
      toast.success('Estado actualizado');

      if (newStage === 'pago_recibido' && onMoveToPago) {
        const lead = leads.find(l => l.id === leadId);
        if (lead) onMoveToPago(lead);
      }

      if (onStageChange) onStageChange(leadId, newStage, oldStage);
      router.refresh();
    } catch {
      toast.error('Error al actualizar estado');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedLeads.map(l => l.id));
    }
  };

  const handleToggleSelectMenu = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleApplyBulkAction = async () => {
    if (selectedLeads.length === 0) return;
    
    const updates: any = {};
    if (massStage) updates.pipeline_stage = massStage;
    if (massAssignedTo.trim()) updates.assigned_to = massAssignedTo.trim();

    if (Object.keys(updates).length === 0) {
      toast.error('Selecciona una acción masiva para aplicar');
      return;
    }

    try {
      await bulkUpdateMutation.mutateAsync({ ids: selectedLeads, data: updates });
      toast.success(`Se actualizaron ${selectedLeads.length} leads masivamente`);
      
      // Handle frontend callback if moving to pago recibido
      if (updates.pipeline_stage === 'pago_recibido' && onMoveToPago) {
        selectedLeads.forEach(id => {
          const lead = leads.find(l => l.id === id);
          if (lead) onMoveToPago(lead);
        });
      }

      setSelectedLeads([]);
      setMassStage('');
      setMassAssignedTo('');
      router.refresh();
    } catch (e: any) {
      toast.error('Ocurrió un error al aplicar acciones masivas');
    }
  };

  // Count leads per state for sub-tabs
  const stateCounts = CRM_COMERCIAL_STATES.reduce((acc, state) => {
    acc[state] = commercialLeads.filter(l => (l.pipeline_stage || 'nuevo') === state).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sub-tabs by status */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => { setStageFilter('all'); setCurrentPage(1); }}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border',
            stageFilter === 'all'
              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
              : 'bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-gray-700'
          )}
        >
          Todos ({commercialLeads.length})
        </button>
        {CRM_COMERCIAL_STATES.map(state => (
          <button
            key={state}
            onClick={() => { setStageFilter(state); setCurrentPage(1); }}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border',
              stageFilter === state
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-gray-700'
            )}
          >
            {getStatusLabel(state)} {stateCounts[state] > 0 && `(${stateCounts[state]})`}
          </button>
        ))}
      </div>

      {/* Mass Action Toolbar */}
      {selectedLeads.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-primary/5 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 p-3 rounded-xl animate-in slide-in-from-top-2">
          <Badge className="bg-primary hover:bg-primary/90 text-white rounded-md px-3 font-bold text-xs flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5" />
            {selectedLeads.length} seleccionados
          </Badge>
          
          <div className="h-6 w-px bg-primary/20 mx-1 hidden sm:block"></div>
          
          <Select value={massStage} onValueChange={setMassStage}>
            <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-gray-900 border-primary/30 text-xs font-semibold">
              <SelectValue placeholder="Cambiar de estado" />
            </SelectTrigger>
            <SelectContent>
              {CRM_COMERCIAL_STATES.map(state => (
                <SelectItem key={state} value={state}>
                  <StatusBadge status={state} className="text-[10px]" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-[180px]">
            <Users className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
            <Input 
              placeholder="Asignar Responsable" 
              value={massAssignedTo}
              onChange={(e) => setMassAssignedTo(e.target.value)}
              className="h-9 pl-8 text-xs font-semibold bg-white dark:bg-gray-900 border-primary/30"
            />
          </div>

          <Button 
            size="sm" 
            onClick={handleApplyBulkAction}
            disabled={bulkUpdateMutation.isPending || (!massStage && !massAssignedTo.trim())}
            className="h-9 px-4 text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {bulkUpdateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : 'Aplicar'}
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedLeads([])} 
            className="h-9 text-xs text-primary hover:text-primary hover:bg-primary/10 ml-auto"
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 dark:bg-gray-800/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, negocio, email, celular..."
            className="pl-9 h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px] h-10 bg-white dark:bg-gray-900">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los canales</SelectItem>
            {['instagram', 'whatsapp', 'landing', 'referido', 'google_form', 'otro'].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchTerm || stageFilter !== 'all' || sourceFilter !== 'all') && (
          <Button
            variant="ghost"
            onClick={() => { setSearchTerm(''); setStageFilter('all'); setSourceFilter('all'); setCurrentPage(1); }}
            className="h-10 px-3 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <FilterX className="h-4 w-4 mr-2" /> Limpiar
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
            <TableRow className="hover:bg-transparent border-b border-gray-100 dark:border-gray-800">
              <TableHead className="py-3 w-[40px] text-center">
                 <Checkbox 
                   checked={selectedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                   onCheckedChange={handleToggleSelectAll}
                   disabled={paginatedLeads.length === 0}
                 />
              </TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[60px]">ID</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[90px]">Fecha</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500">Nombre / Negocio</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500">Contacto</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[90px]">Canal</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[80px]">Ped/día</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">Interesado en</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[140px]">Estado</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">Responsable</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[90px]">Últ. Contacto</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLeads.map((lead) => (
              <TableRow
                key={lead.id}
                className={cn("group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors border-b border-gray-50 dark:border-gray-800 cursor-pointer", selectedLeads.includes(lead.id) && "bg-primary/5 dark:bg-primary/10")}
                onClick={() => handleOpenDetails(lead)}
              >
                <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                   <Checkbox 
                     checked={selectedLeads.includes(lead.id)}
                     onCheckedChange={() => handleToggleSelectMenu(lead.id)}
                   />
                </TableCell>
                <TableCell className="py-3 text-[10px] text-gray-400 font-mono">
                  {lead.id?.slice(0, 6)}
                </TableCell>
                <TableCell className="py-3 text-xs text-gray-500">
                  {new Date(lead.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors truncate max-w-[180px]">
                      {lead.contact_name}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 italic truncate max-w-[180px]">
                      {lead.business_name || '—'} 
                      {lead.observations && (
                         <MessageSquare 
                           className="inline ml-2 h-3.5 w-3.5 text-blue-500 cursor-pointer hover:text-blue-700 hover:scale-110 transition-transform" 
                           onClick={(e) => { e.stopPropagation(); handleOpenActivities(lead); }}
                         />
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                      <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{lead.phone_whatsapp || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
                      <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{lead.email || '—'}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'capitalize text-[10px] font-bold px-2 py-0.5 border-none shadow-none',
                      SOURCE_COLORS[lead.source?.toLowerCase()] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    )}
                  >
                    {lead.source?.replace('_', ' ') || '—'}
                  </Badge>
                </TableCell>
                <TableCell className="py-3 text-xs text-gray-600 dark:text-gray-400 text-center">
                  {lead.orders_per_day ?? '—'}
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
                  {lead.interested_in || lead.plan_interest || '—'}
                </TableCell>
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <Select
                    defaultValue={lead.pipeline_stage || 'nuevo'}
                    onValueChange={(newStage) => handleStageChange(lead.id, newStage, lead.pipeline_stage || 'nuevo')}
                  >
                    <SelectTrigger className="h-7 w-[130px] border-none bg-transparent p-0 shadow-none focus:ring-0 [&>span]:p-0">
                      <StatusBadge status={lead.pipeline_stage || 'nuevo'} />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_COMERCIAL_STATES.map(state => (
                        <SelectItem key={state} value={state}>
                          <StatusBadge status={state} className="text-[10px]" />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[90px]">
                  {lead.assigned_to || '—'}
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-500">
                  {lead.last_contact_at
                    ? new Date(lead.last_contact_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })
                    : '—'}
                </TableCell>
                <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-1">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-400 px-2 py-1.5">Acciones</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md"
                        onClick={() => handleOpenDetails(lead)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" /> Ver Detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md"
                        onClick={() => handleOpenActivities(lead)}
                      >
                        <History className="h-3.5 w-3.5 text-gray-400" /> Actividades
                      </DropdownMenuItem>
                      {(lead.pipeline_stage === 'cerrado' || lead.pipeline_stage === 'ganado') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-sm cursor-pointer rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                            onClick={() => handleStageChange(lead.id, 'pago_recibido', lead.pipeline_stage)}
                          >
                            <ArrowRightCircle className="h-3.5 w-3.5" /> Mover a Activación
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                        disabled={isDeleting === lead.id}
                        onClick={() => handleDeleteLead(lead.id)}
                      >
                        {isDeleting === lead.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredLeads.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="h-48 text-center bg-gray-50/30 dark:bg-gray-800/5">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FilterX className="h-8 w-8 text-gray-200 dark:text-gray-800" />
                    <p className="text-sm font-medium text-gray-400 italic">No se encontraron prospectos con estos filtros.</p>
                    <Button variant="link" size="sm" onClick={() => { setSearchTerm(''); setStageFilter('all'); setSourceFilter('all'); }}>
                      Mostrar todos
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Mostrando <span className="text-gray-900 dark:text-gray-100">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="text-gray-900 dark:text-gray-100">{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> de <span className="text-gray-900 dark:text-gray-100">{filteredLeads.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Ant
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, i, arr) => (
                  <React.Fragment key={p}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-300 text-xs">...</span>}
                    <Button
                      variant={currentPage === p ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => handlePageChange(p)}
                      className={cn('h-7 w-7 text-[10px] font-bold rounded-lg p-0', currentPage === p ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500')}
                    >
                      {p}
                    </Button>
                  </React.Fragment>
                ))}
            </div>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-1">
              Sig <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <LeadDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        lead={selectedLead}
      />

      <LeadActivitiesDrawer
        isOpen={isActivitiesOpen}
        onClose={() => setIsActivitiesOpen(false)}
        leadId={selectedLead?.id}
        leadName={selectedLead?.contact_name}
      />
    </div>
  );
};
