import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActivateLead } from "@/hooks/useLeads";
import { toast } from "sonner";
import { Rocket, Loader2, Building2, User, Mail, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadActivationFlowProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  token?: string;
}

export const LeadActivationFlow: React.FC<LeadActivationFlowProps> = ({ lead, open, onClose, token }) => {
  const [formData, setFormData] = useState({
    business_name: lead?.business_name || '',
    contact_name: lead?.contact_name || '',
    email: lead?.email || '',
  });

  const { mutate: activateLead, isPending } = useActivateLead(token);

  const handleActivate = () => {
    // In a real scenario, we might want to send the updated formData too
    // For now, the backend 'activate' just uses the lead ID
    activateLead(lead.id, {
      onSuccess: () => {
        toast.success("¡Empresa activada exitosamente!");
        onClose();
      },
      onError: (error: any) => {
        toast.error(`Error al activar: ${error.message || 'Error desconocido'}`);
      }
    });
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-gray-950">
        <div className="bg-emerald-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Rocket className="h-24 w-24" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-100/80">Confirmación de Alta</span>
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white leading-tight">
              Activar {lead.business_name}
            </DialogTitle>
            <DialogDescription className="text-emerald-50/80 text-sm mt-1">
              Estás por convertir este lead en una cuenta activa de PowIp.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_name" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Nombre de la Empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  id="business_name" 
                  value={formData.business_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                  className="pl-9 h-10 border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Admin Principal</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input 
                    id="contact_name" 
                    value={formData.contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    className="pl-9 h-10 border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Email Acceso</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input 
                    id="email" 
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-9 h-10 border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-xl flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
              Al confirmar, se creará el perfil de empresa, se dará de alta al usuario administrador y se iniciará el flujo de onboarding automático.
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 h-12 font-bold uppercase tracking-widest text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border-none"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleActivate}
            disabled={isPending}
            className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Rocket className="h-4 w-4 mr-2" />
            )}
            {isPending ? 'Activando...' : 'Confirmar Alta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
