'use client';

import React, { useState, useEffect } from 'react';
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
  DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search, FilterX, MoreVertical, ChevronLeft, ChevronRight,
  History, HeartHandshake, CalendarCheck, CheckSquare, Users, Loader2, MessageSquare, Trash2, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { StatusBadge, POSTVENTA_STATES, getStatusLabel } from './StatusBadge';
import { LeadActivitiesDrawer } from './LeadActivitiesDrawer';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from "@/utils/supabase/client";
import { useDeletePostventaLead } from "@/hooks/useLeads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { PostventaDetailModal } from './PostventaDetailModal';

interface PostventaTableProps {
  postventa: any[];
  token?: string;
  onUpdateStatus?: (id: string, status: string) => void;
}

export const PostventaTable: React.FC<PostventaTableProps> = ({
  postventa,
  token,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Deletion state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<any>(null);

  // Mass update state
  const [selectedPostventa, setSelectedPostventa] = useState<string[]>([]);
  const [massStatus, setMassStatus] = useState<string>('');
  const [massAssignedTo, setMassAssignedTo] = useState<string>('');
  const [isMassUpdating, setIsMassUpdating] = useState(false);

  const itemsPerPage = 10;
  const router = useRouter();
  const deleteMutation = useDeletePostventaLead(token);

  const handleOpenDetail = (item: any) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const filteredData = postventa.filter(item => {
    const name = item.business_name || item.lead?.business_name || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.client_status === statusFilter;
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
      const response = await fetch(`/api/superadmin/leads/postventa/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ client_status: newStatus }),
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

  const handleDelete = async () => {
    if (!leadToDelete) return;
    
    try {
      await deleteMutation.mutateAsync(leadToDelete.id);
      toast.success('Cliente eliminado correctamente');
      setIsDeleteDialogOpen(false);
      setLeadToDelete(null);
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error('Error al eliminar el cliente');
    }
  };

  const handleSetDate = async (id: string, field: string) => {
    setIsUpdating(id);
    try {
      const response = await fetch(`/api/superadmin/leads/postventa/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: new Date().toISOString() }),
      });

      if (!response.ok) throw new Error('Error updating');

      toast.success('Fecha registrada');
      router.refresh();
    } catch {
      toast.error('Error al registrar fecha');
    } finally {
      setIsUpdating(null);
    }
  };

  // Bulk actions handlers
  const handleToggleSelectAll = () => {
    if (selectedPostventa.length === paginatedData.length && paginatedData.length > 0) {
      setSelectedPostventa([]);
    } else {
      setSelectedPostventa(paginatedData.map(p => p.id));
    }
  };

  const handleToggleSelectMenu = (id: string) => {
    setSelectedPostventa(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleApplyBulkAction = async () => {
    if (selectedPostventa.length === 0) return;
    
    const updates: any = {};
    if (massStatus) updates.client_status = massStatus;
    if (massAssignedTo.trim()) updates.assigned_to = massAssignedTo.trim();

    if (Object.keys(updates).length === 0) {
      toast.error('Selecciona una acción masiva para aplicar');
      return;
    }

    setIsMassUpdating(true);
    try {
      await Promise.all(selectedPostventa.map(id => 
        fetch(`/api/superadmin/leads/postventa/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        })
      ));

      toast.success(`Se actualizaron ${selectedPostventa.length} registros masivamente`);
      setSelectedPostventa([]);
      setMassStatus('');
      setMassAssignedTo('');
      router.refresh();
    } catch (e: any) {
      toast.error('Ocurrió un error al aplicar acciones masivas');
    } finally {
      setIsMassUpdating(false);
    }
  };

  // Onboarding progress state
  const [onboardingData, setOnboardingData] = useState<Record<string, any>>({});
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);

  useEffect(() => {
    const fetchOnboarding = async () => {
      const bizIds = paginatedData
        .map(i => i.business_id)
        .filter(id => id && id.length > 5); // Ensure they are valid UUIDs

      if (bizIds.length === 0) return;

      setLoadingOnboarding(true);
      try {
        const supabase = await createClient();
        const { data: steps, error } = await supabase
          .from('onboarding_progress')
          .select('*')
          .in('business_id', bizIds);

        if (error) throw error;

        // Group by business_id
        const grouped = (steps || []).reduce((acc: any, step: any) => {
          if (!acc[step.business_id]) acc[step.business_id] = {};
          acc[step.business_id][step.step_code] = step.completed;
          return acc;
        }, {});

        setOnboardingData(prev => ({ ...prev, ...grouped }));
      } catch (e) {
        console.error("Error fetching onboarding:", e);
      } finally {
        setLoadingOnboarding(false);
      }
    };

    fetchOnboarding();
  }, [paginatedData.map(i => i.id).join(','), currentPage]);

  // Count items per state for sub-tabs
  const stateCounts = POSTVENTA_STATES.reduce((acc, state) => {
    acc[state] = postventa.filter(p => p.client_status === state).length;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es', { day: '2-digit', month: 'short' });
  };

  const OnboardingIndicator = ({ businessId, stepCode, label }: { businessId: string, stepCode: string, label: string }) => {
    const isCompleted = onboardingData[businessId]?.[stepCode];
    return (
      <div 
        title={`${label}: ${isCompleted ? 'Completado' : 'Pendiente'}`}
        className={cn(
          "w-3 h-3 rounded-full border transition-all cursor-help",
          isCompleted 
            ? "bg-emerald-500 border-emerald-600 shadow-sm" 
            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300"
        )}
      />
    );
  };

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
          Todos ({postventa.length})
        </button>
        {POSTVENTA_STATES.map(state => (
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
      {selectedPostventa.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-primary/5 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 p-3 rounded-xl animate-in slide-in-from-top-2">
          <Badge className="bg-primary hover:bg-primary/90 text-white rounded-md px-3 font-bold text-xs flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5" />
            {selectedPostventa.length} seleccionados
          </Badge>
          
          <div className="h-6 w-px bg-primary/20 mx-1 hidden sm:block"></div>
          
          <Select value={massStatus} onValueChange={setMassStatus}>
            <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-gray-900 border-primary/30 text-xs font-semibold">
              <SelectValue placeholder="Cambiar de estado" />
            </SelectTrigger>
            <SelectContent>
              {POSTVENTA_STATES.map(state => (
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
            onClick={() => setSelectedPostventa([])} 
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
            placeholder="Buscar por negocio..."
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
                   checked={selectedPostventa.length > 0 && selectedPostventa.length === paginatedData.length}
                   onCheckedChange={handleToggleSelectAll}
                   disabled={paginatedData.length === 0}
                 />
              </TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[60px]">ID</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500">Negocio</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">F. Activación</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[150px]">Onboarding (6 Pasos)</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[140px]">Estado</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 w-[100px]">Responsable</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500">Observaciones</TableHead>
              <TableHead className="py-3 font-bold text-[10px] uppercase tracking-widest text-gray-500 text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item) => (
              <TableRow
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className={cn("group cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors border-b border-gray-50 dark:border-gray-800", selectedPostventa.includes(item.id) && "bg-primary/5 dark:bg-primary/10")}
              >
                <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                   <Checkbox 
                     checked={selectedPostventa.includes(item.id)}
                     onCheckedChange={() => handleToggleSelectMenu(item.id)}
                   />
                </TableCell>
                <TableCell className="py-3 text-[10px] text-gray-400 font-mono">
                  {item.id?.slice(0, 6)}
                </TableCell>
                <TableCell className="py-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {item.business_name || item.lead?.business_name || '—'}
                  </span>
                  {item.lead?.observations && (
                     <MessageSquare 
                       className="inline ml-2 h-3.5 w-3.5 text-blue-500 cursor-pointer hover:text-blue-700 hover:scale-110 transition-transform" 
                       onClick={(e) => { 
                         e.stopPropagation();
                         setSelectedItem(item);
                         setIsActivitiesOpen(true);
                       }}
                     />
                  )}
                </TableCell>
                <TableCell className="py-3 text-xs text-gray-500">
                  {formatDate(item.activation_date)}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5 p-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 w-fit">
                    <OnboardingIndicator businessId={item.business_id} stepCode="business_profile" label="Perfil" />
                    <OnboardingIndicator businessId={item.business_id} stepCode="store_config" label="Tienda" />
                    <OnboardingIndicator businessId={item.business_id} stepCode="inventory_init" label="Inventario" />
                    <OnboardingIndicator businessId={item.business_id} stepCode="first_order" label="Primer Pedido" />
                    <OnboardingIndicator businessId={item.business_id} stepCode="integrations" label="Integraciones" />
                    <OnboardingIndicator businessId={item.business_id} stepCode="final_training" label="Capacitación" />
                  </div>
                </TableCell>
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <Select
                    defaultValue={item.client_status}
                    onValueChange={(v) => handleStatusUpdate(item.id, v)}
                    disabled={isUpdating === item.id}
                  >
                    <SelectTrigger className="h-7 w-[130px] border-none bg-transparent p-0 shadow-none focus:ring-0 [&>span]:p-0">
                      <StatusBadge status={item.client_status} />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTVENTA_STATES.map(state => (
                        <SelectItem key={state} value={state}>
                          <StatusBadge status={state} className="text-[10px]" />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[90px]">
                  {item.assigned_to || '—'}
                </TableCell>
                <TableCell className="py-3 text-[11px] text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                  {item.observations || '—'}
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
                        onClick={() => handleOpenDetail(item)}
                      >
                        <Search className="h-3.5 w-3.5 text-gray-400" /> Ver Detalles
                      </DropdownMenuItem>
                      {item.lead_id && (
                        <DropdownMenuItem
                          className="gap-2 text-sm cursor-pointer rounded-md"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsActivitiesOpen(true);
                          }}
                        >
                          <History className="h-3.5 w-3.5 text-gray-400" /> Historial
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer rounded-md text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                        onClick={() => {
                          setLeadToDelete(item);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar Cliente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="h-48 text-center bg-gray-50/30 dark:bg-gray-800/5">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <HeartHandshake className="h-8 w-8 text-gray-200 dark:text-gray-800" />
                    <p className="text-sm font-medium text-gray-400 italic">No hay clientes en postventa aún.</p>
                    <p className="text-xs text-gray-400">Los clientes aparecen aquí cuando completan la fase de activación.</p>
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
            {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 px-3 text-[10px] font-black uppercase gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Ant
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 px-3 text-[10px] font-black uppercase gap-1">
              Sig <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {selectedItem?.lead_id && (
        <LeadActivitiesDrawer
          isOpen={isActivitiesOpen}
          onClose={() => setIsActivitiesOpen(false)}
          leadId={selectedItem.lead_id}
          leadName={selectedItem.business_name || selectedItem.lead?.business_name}
          token={token}
        />
      )}

      {selectedItem?.lead_id && (
        <PostventaDetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          leadId={selectedItem.lead_id}
          token={token}
        />
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-black">¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm">
              Esta acción eliminará permanentemente todos los datos de{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {leadToDelete?.business_name || leadToDelete?.lead?.business_name || 'este cliente'}
              </span>
              . No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
            <AlertDialogCancel className="h-10 px-6 text-[11px] font-black uppercase tracking-widest border-slate-200">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Sí, Eliminar Todo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
