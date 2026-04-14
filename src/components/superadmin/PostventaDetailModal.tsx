'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Building2, 
  Phone, 
  Mail, 
  ShieldCheck,
  Copy,
  CheckCircle2,
  Lock,
  ExternalLink,
  Loader2,
  Calendar,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

interface PostventaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  token?: string;
}

export const PostventaDetailModal: React.FC<PostventaDetailModalProps> = ({
  isOpen,
  onClose,
  leadId,
  token,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const deleteMutation = useDeletePostventaLead(token);

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !leadId) return;
      
      setLoading(true);
      try {
        const supabase = await createClient();
        
        // Fetch lead information with joined activation data
        const { data: leadData, error } = await supabase
          .from('leads')
          .select(`
            *,
            activations:lead_activations(*)
          `)
          .eq('id', leadId)
          .single();

        if (error) throw error;
        setData(leadData);
      } catch (err) {
        console.error("Error fetching lead detail:", err);
        toast.error("No se pudo cargar la información del cliente");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, leadId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const activation = data?.activations?.[0];
  const tempPassword = activation?.temp_password || 'No disponible';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalle del Cliente - {data?.business_name || 'Cargando...'}</DialogTitle>
          <DialogDescription>
            Vista detallada de las credenciales y estado de post-venta del negocio.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="h-[400px] flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-slate-500 font-medium italic">Consultando datos del cliente...</p>
          </div>
        ) : data ? (
          <>
            <div className="bg-primary p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
                <Building2 className="h-24 w-24" />
              </div>
              <div className="relative z-10 space-y-1">
                <div className="flex items-center gap-3 mb-1">
                  <Badge variant="outline" className="bg-white/20 border-white/30 text-white text-[10px] font-black uppercase tracking-widest">
                    Post-Venta
                  </Badge>
                  <div className="h-1 w-1 rounded-full bg-white/40" />
                  <span className="text-[10px] uppercase font-bold text-white/70 tracking-widest leading-none">
                    ID: {data.id.slice(0, 8)}
                  </span>
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
                  {data.business_name || 'Negocio sin nombre'}
                </h2>
                <div className="flex items-center gap-2 text-white/80 text-xs mt-1 font-medium">
                  <User className="h-3.5 w-3.5 text-white/60" />
                  {data.contact_name}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-8 scrollbar-hide max-h-[70vh] overflow-y-auto">
              {/* Sección de Credenciales */}
              <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
                    Información de Acceso del Cliente
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl group transition-all hover:border-primary/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">URL de Acceso</label>
                        <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200">www.powip.tech</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-3 text-[10px] font-black uppercase gap-2 text-primary hover:bg-primary/10"
                        onClick={() => copyToClipboard("https://www.powip.tech", "URL")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar URL
                      </Button>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/10 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Email de Inicio de Sesión</label>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate block">
                          {data.email}
                        </span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 px-4 text-[10px] font-black uppercase gap-2 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => copyToClipboard(data.email, "Email")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar Email
                      </Button>
                    </div>

                    <div className="pt-4 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg shrink-0">
                          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">Regla de Contraseña</label>
                          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                            La contraseña es la combinación en <span className="font-black text-slate-900 dark:text-white">minúsculas</span> del número de teléfono: <span className="font-black text-slate-900 dark:text-white underline decoration-emerald-500/30">{data.phone_whatsapp}</span> y el nombre: <span className="font-black text-slate-900 dark:text-white underline decoration-emerald-500/30">{data.contact_name?.split(' ')[0]?.toLowerCase()}</span>.
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">Ejemplo: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{`${data.phone_whatsapp || ''}${data.contact_name?.split(' ')[0]?.toLowerCase() || ''}`.replace(/\s/g, '')}</code></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-3 rounded-xl flex items-center gap-3">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-black uppercase">Rol</Badge>
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-300">Administrador / Owner</span>
                  </div>
                </div>
              </div>

              {/* Información General */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Teléfono Principal</label>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {data.phone_whatsapp}
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Fecha de Activación</label>
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 justify-end">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {activation?.activation_date ? new Date(activation.activation_date).toLocaleDateString() : 'Pendiente'}
                  </div>
                </div>
              </div>

              {data.observations && (
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-xl">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-amber-600 block mb-2">Comentarios de Activación</label>
                  <p className="text-xs text-amber-800 dark:text-amber-200 italic leading-relaxed">
                    &quot;{data.observations}&quot;
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={() => setIsDeleteDialogOpen(true)} 
                variant="ghost" 
                className="h-10 px-4 text-[11px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Cuenta
              </Button>
              <div className="flex-1" />
              <Button onClick={onClose} variant="secondary" className="h-10 px-8 text-[11px] font-black uppercase tracking-widest border-slate-200">
                Cerrar Detalle
              </Button>
              <Button 
                className="h-10 px-8 bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                onClick={() => window.open("https://www.powip.tech", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Ir al Panel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center p-8 text-center">
            <DialogHeader className="sr-only">
              <DialogTitle>Error al cargar</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-500 font-medium">No se encontró información para este prospecto.</p>
            <Button onClick={onClose} variant="ghost" className="mt-4">Cerrar</Button>
          </div>
        )}
      </DialogContent>

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
                {data?.business_name || 'este cliente'}
              </span>
              . No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 mt-4">
            <AlertDialogCancel className="h-10 px-6 text-[11px] font-black uppercase tracking-widest border-slate-200">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await deleteMutation.mutateAsync(leadId);
                  toast.success('Cliente eliminado correctamente');
                  onClose();
                } catch (error) {
                  console.error("Error deleting lead:", error);
                  toast.error('Error al eliminar el cliente');
                }
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
    </Dialog>
  );
};
