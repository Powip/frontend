import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  FilterX, 
  MoreVertical, 
  Mail, 
  Phone, 
  ExternalLink, 
  Rocket,
  History,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActivateLead } from "@/hooks/useLeads";
import { toast } from "sonner";
import { LeadActivationFlow } from './LeadActivationFlow';

interface LeadsTableProps {
  leads: any[];
  token?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  landing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  referido: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
};

export const LeadsTable: React.FC<LeadsTableProps> = ({ leads, token }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isActivationOpen, setIsActivationOpen] = useState(false);

  // We are not using the hook's mutation here because LeadActivationFlow handles it,
  // but if we were using it in this file, we would pass the token.
  // Actually, LeadActivationFlow will need the token too.

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStage = stageFilter === 'all' || lead.pipeline_stage === stageFilter;
    const matchesSource = sourceFilter === 'all' || lead.source?.toLowerCase() === sourceFilter;

    return matchesSearch && matchesStage && matchesSource;
  });

  const handleOpenActivation = (lead: any) => {
    setSelectedLead(lead);
    setIsActivationOpen(true);
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 dark:bg-gray-800/20 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, negocio o email..."
            className="pl-9 h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px] h-10 bg-white dark:bg-gray-900">
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etapas</SelectItem>
              {['nuevo', 'contactado', 'demo_agendada', 'demo_realizada', 'evaluacion', 'cerrado', 'perdido'].map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px] h-10 bg-white dark:bg-gray-900">
              <SelectValue placeholder="Fuente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fuentes</SelectItem>
              {['instagram', 'whatsapp', 'landing', 'referido', 'otro'].map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchTerm || stageFilter !== 'all' || sourceFilter !== 'all') && (
            <Button 
              variant="ghost" 
              onClick={() => { setSearchTerm(''); setStageFilter('all'); setSourceFilter('all'); }} 
              className="h-10 px-3 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              <FilterX className="h-4 w-4 mr-2" /> 
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm overflow-x-auto pb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Table>
            <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
              <TableRow className="hover:bg-transparent border-b border-gray-100 dark:border-gray-800">
                <TableHead className="py-4 font-bold text-[11px] uppercase tracking-widest text-gray-500">Contacto / Negocio</TableHead>
                <TableHead className="py-4 font-bold text-[11px] uppercase tracking-widest text-gray-500">Comunicación</TableHead>
                <TableHead className="py-4 font-bold text-[11px] uppercase tracking-widest text-gray-500">Estado Pipeline</TableHead>
                <TableHead className="py-4 font-bold text-[11px] uppercase tracking-widest text-gray-500">Origen</TableHead>
                <TableHead className="py-4 font-bold text-[11px] uppercase tracking-widest text-gray-500">Fecha Alta</TableHead>
                <TableHead className="py-4 text-right font-bold text-[11px] uppercase tracking-widest text-gray-500">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors border-b border-gray-50 dark:border-gray-800">
                  <TableCell className="py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                        {lead.contact_name}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                        {lead.business_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Mail className="h-3 w-3 text-gray-400" />
                        {lead.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Phone className="h-3 w-3 text-gray-400" />
                        {lead.phone_whatsapp}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "capitalize text-[10px] font-black px-2 py-0.5 border-none",
                        lead.pipeline_stage === 'cerrado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        lead.pipeline_stage === 'perdido' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                      )}
                    >
                      {(lead.pipeline_stage || 'nuevo').replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "capitalize text-[10px] font-bold px-2 py-0.5 border-none shadow-none",
                        SOURCE_COLORS[lead.source?.toLowerCase()] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}
                    >
                      {lead.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-1">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-400 px-2 py-1.5">Opciones de Lead</DropdownMenuLabel>
                        <DropdownMenuItem className="gap-2 text-sm cursor-pointer rounded-md">
                          <ExternalLink className="h-3.5 w-3.5 text-gray-400" /> Ver Detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-sm cursor-pointer rounded-md">
                          <History className="h-3.5 w-3.5 text-gray-400" /> Registro Actividades
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {lead.pipeline_stage === 'cerrado' && (
                          <DropdownMenuItem 
                            className="gap-2 text-sm cursor-pointer rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                            onClick={() => handleOpenActivation(lead)}
                          >
                            <Rocket className="h-3.5 w-3.5" /> Dar de alta
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="gap-2 text-sm cursor-pointer rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10">
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar Lead
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center bg-gray-50/30 dark:bg-gray-800/5">
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
      <LeadActivationFlow 
        lead={selectedLead}
        open={isActivationOpen}
        onClose={() => setIsActivationOpen(false)}
        token={token}
      />
    </div>
  );
};
