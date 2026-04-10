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
  Search, FilterX, MoreVertical, Rocket, ChevronLeft, ChevronRight,
  Loader2, ExternalLink, History, Edit2, CheckSquare, Users, MessageSquare,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { StatusBadge, ACTIVACION_STATES, getStatusLabel } from './StatusBadge';
import { LeadActivationFlow } from './LeadActivationFlow';
import { LeadActivitiesDrawer } from './LeadActivitiesDrawer';
import { Checkbox } from '@/components/ui/checkbox';

interface ActivacionTableProps {
  activations: any[];
  token?: string;
  auth?: any;
  plans?: any[];
  onUpdateStatus?: (id: string, status: string) => void;
}

export const ActivacionTable: React.FC<ActivacionTableProps> = ({
  activations,
  token,
  auth,
  plans,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedActivation, setSelectedActivation] = useState<any>(null);
  const [isActivationFlowOpen, setIsActivationFlowOpen] = useState(false);
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Mass update state
  const [selectedActivations, setSelectedActivations] = useState<string[]>([]);
  const [massStatus, setMassStatus] = useState<string>('');
  const [massAssignedTo, setMassAssignedTo] = useState<string>('');
  const [isMassUpdating, setIsMassUpdating] = useState(false);

  const itemsPerPage = 10;
  const router = useRouter();

  // Filter out alta_completa items (they move to Postventa)
  const activeActivations = activations.filter(a => {
    return a.activation_status !== 'alta_completa';
  });

  const filteredData = activeActivations.filter(item => {
    const name = item.business_name || item.lead?.business_name || '';
    const contact = item.contact_name || item.lead?.contact_name || '';

    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.activation_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setIsUpdating(id);
    try {
      const response = await fetch(`/api/superadmin/leads/activations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ activation_status: newStatus }),
      });

      if (!response.ok) throw new Error('Error updating');

      toast.success(`Estado cambiado a: ${getStatusLabel(newStatus)}`);
      if (onUpdateStatus) onUpdateStatus(id, newStatus);
      router.refresh();
    } catch {
      toast.error('Error al actualizar estado');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleOpenActivation = (item: any) => {
    setSelectedActivation({
      ...item.lead,
      activation_id: item.id,
      business_name: item.business_name || item.lead?.business_name,
      contact_name: item.contact_name || item.lead?.contact_name,
      email: item.lead?.email,
      phone_whatsapp: item.lead?.phone_whatsapp || item.lead?.phoneNumber,
    });
    setIsActivationFlowOpen(true);
  };

  const handleResetToLead = async (item: any) => {
    if (!window.confirm("¿Desea devolver este lead al CRM Comercial? Se perderá el rastro de activación.")) return;
    setIsUpdating(item.id);
    try {
      // 1. Reset pipeline stage in leads table
      await fetch(`/api/superadmin/leads/${item.lead_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ pipeline_stage: 'nuevo' }),
      });

      // 2. Delete the activation record
      await fetch(`/api/superadmin/leads/activations/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      toast.success("Lead devuelto al CRM Comercial");
      router.refresh();
    } catch (e) {
      toast.error("Error al resetear lead");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteLead = async (item: any) => {
    if (!window.confirm("¿ESTÁ SEGURO? Se eliminará el lead por completo y su registro de activación.")) return;
    setIsUpdating(item.id);
    try {
      // 1. Delete lead
      await fetch(`/api/superadmin/leads/${item.lead_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 2. Delete activation (server might handle this via cascade, but being safe)
      await fetch(`/api/superadmin/leads/activations/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      toast.success("Lead eliminado permanentemente");
      router.refresh();
    } catch (e) {
      toast.error("Error al eliminar lead");
    } finally {
      setIsUpdating(null);
    }
  };

  // Bulk actions handlers
  const handleToggleSelectAll = () => {
    if (selectedActivations.length === paginatedData.length && paginatedData.length > 0) {
      setSelectedActivations([]);
    } else {
      setSelectedActivations(paginatedData.map(a => a.id));
    }
  };

  const handleToggleSelectMenu = (id: string) => {
    setSelectedActivations(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleApplyBulkAction = async () => {
    if (selectedActivations.length === 0) return;
    
    const updates: any = {};
    if (massStatus) updates.activation_status = massStatus;
    if (massAssignedTo.trim()) updates.assigned_to = massAssignedTo.trim();

    if (Object.keys(updates).length === 0) {
      toast.error('Selecciona una acción masiva para aplicar');
      return;
    }

    setIsMassUpdating(true);
    try {
      await Promise.all(selectedActivations.map(id => 
        fetch(`/api/superadmin/leads/activations/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        })
      ));

      toast.success(`Se actualizaron ${selectedActivations.length} activaciones masivamente`);
      setSelectedActivations([]);
      setMassStatus('');
      setMassAssignedTo('');
      router.refresh();
    } catch (e: any) {
      toast.error('Ocurrió un error al aplicar acciones masivas');
    } finally {
      setIsMassUpdating(false);
    }
  };


  // Count items per state for sub-tabs
  const stateCounts = ACTIVACION_STATES.reduce((acc, state) => {
    acc[state] = activeActivations.filter(a => a.activation_status === state).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Sub-tabs by status */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border',
            statusFilter === 'all'
              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
              : 'bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700'
          )}
        >
          Todos ({activeActivations.length})
        </button>
        {ACTIVACION_STATES.filter(s => s !== 'alta_completa').map(state => (
          <button
            key={state}
            onClick={() => { setStatusFilter(state); setCurrentPage(1); }}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border',
              statusFilter === state
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-white dark:bg-gray-900 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-gray-700'
            )}
          >
            {getStatusLabel(state)} {stateCounts[state] > 0 && `(${stateCounts[state]})`}
          </button>
        ))}
      </div>

      {/* Mass Action Toolbar */}
      {selectedActivations.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-primary/5 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 p-3 rounded-xl animate-in slide-in-from-top-2">
          <Badge className="bg-primary hover:bg-primary/90 text-white rounded-md px-3 font-bold text-xs flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5" />
            {selectedActivations.length} seleccionados
          </Badge>
          
          <div className="h-6 w-px bg-primary/20 mx-1 hidden sm:block"></div>
          
          <Select value={massStatus} onValueChange={setMassStatus}>
            <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-gray-900 border-primary/30 text-xs font-semibold">
              <SelectValue placeholder="Cambiar de estado" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVACION_STATES.map(state => (
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
            disabled={isMassUpdating || (!massStatus && !massAssignedTo.trim())}
            className="h-9 px-4 text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {isMassUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : 'Aplicar'}
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedActivations([])} 
            className="h-9 text-xs text-primary hover:text-primary hover:bg-primary/10 ml-auto"
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-800/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por negocio o contacto..."
            className="pl-9 h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        {(searchTerm || statusFilter !== 'all') && (
          <Button
            variant="ghost"
            onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCurrentPage(1); }}
            className="h-10 px-3 text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                   checked={selectedActivations.length > 0 && selectedActivations.length === paginatedData.length}
                   onCheckedChange={handleToggleSelectAll}
                   disabled={paginatedData.length === 0}
                 />
              </TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[60px]">ID</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500">Negocio</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500">Contacto</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[90px]">Plan</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[90px]">Pago</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">F. Activación</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[160px]">Estado</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">Integraciones</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">Capacitación</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">Responsable</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item) => (
              <TableRow
                key={item.id}
                className={cn("group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors border-b border-gray-50 dark:border-gray-800 cursor-pointer", selectedActivations.includes(item.id) && "bg-primary/5 dark:bg-primary/10")}
                onClick={() => handleOpenActivation(item)}
              >
                <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                   <Checkbox 
                     checked={selectedActivations.includes(item.id)}
                     onCheckedChange={() => handleToggleSelectMenu(item.id)}
                   />
                </TableCell>
                <TableCell className="py-3 text-[10px] text-gray-400 font-mono">
                  {item.id?.slice(0, 6)}
                </TableCell>
                <TableCell className="py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                  {item.business_name || item.lead?.business_name || '—'}
                  {item.lead?.observations && (
                     <MessageSquare 
                       className="inline ml-2 h-3.5 w-3.5 text-blue-500 cursor-pointer hover:text-blue-700 hover:scale-110 transition-transform" 
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         setSelectedActivation(item);
                         setIsActivitiesOpen(true);
                       }}
                     />
                  )}
                </TableCell>
                <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                  {item.contact_name || item.lead?.contact_name || '—'}
                </TableCell>
                <TableCell className="py-3 text-xs text-gray-600 dark:text-gray-400">
                  {item.plan || '—'}
                </TableCell>
                <TableCell className="py-3 text-xs text-gray-500">
                  {item.payment_received_at
                    ? new Date(item.payment_received_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })
                    : '—'}
                </TableCell>
                <TableCell className="py-3 text-xs text-gray-500">
                  {item.activation_date
                    ? new Date(item.activation_date).toLocaleDateString('es', { day: '2-digit', month: 'short' })
                    : '—'}
                </TableCell>
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <Select
                    defaultValue={item.activation_status}
                    onValueChange={(v) => handleStatusUpdate(item.id, v)}
                    disabled={isUpdating === item.id}
                  >
                    <SelectTrigger className="h-7 w-[150px] border-none bg-transparent p-0 shadow-none focus:ring-0 [&>span]:p-0">
                      <StatusBadge status={item.activation_status} />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVACION_STATES.map(state => (
                        <SelectItem key={state} value={state}>
                          <StatusBadge status={state} className="text-[10px]" />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
                  {item.integrations || '—'}
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[100px]">
                  {item.training || '—'}
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[90px]">
                  {item.assigned_to || '—'}
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
                      {item.lead_id && (
                        <DropdownMenuItem
                          className="gap-2 text-sm cursor-pointer rounded-md"
                          onClick={() => {
                            setSelectedActivation(item);
                            setIsActivitiesOpen(true);
                          }}
                        >
                          <History className="h-3.5 w-3.5 text-gray-400" /> Historial
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                        onClick={() => handleOpenActivation(item)}
                      >
                        <Rocket className="h-3.5 w-3.5" /> Dar de alta
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10"
                        onClick={() => handleResetToLead(item)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Volver a Lead Nuevo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                        onClick={() => handleDeleteLead(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Eliminar Lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="h-48 text-center bg-gray-50/30 dark:bg-gray-800/5">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Rocket className="h-8 w-8 text-gray-200 dark:text-gray-800" />
                    <p className="text-sm font-medium text-gray-400 italic">No hay registros de activación aún.</p>
                    <p className="text-xs text-gray-400">Los leads aparecen aquí cuando su estado pasa a &quot;Pago recibido&quot;.</p>
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
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Ant
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-1">
              Sig <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <LeadActivationFlow
        lead={selectedActivation}
        open={isActivationFlowOpen}
        onClose={() => setIsActivationFlowOpen(false)}
        token={token}
        auth={auth}
        plans={plans}
      />

      {selectedActivation?.lead_id && (
        <LeadActivitiesDrawer
          isOpen={isActivitiesOpen}
          onClose={() => setIsActivitiesOpen(false)}
          leadId={selectedActivation.lead_id}
          leadName={selectedActivation.business_name || selectedActivation.lead?.business_name}
          token={token}
        />
      )}
    </div>
  );
};
