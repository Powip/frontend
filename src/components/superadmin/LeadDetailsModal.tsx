import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  User, 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  Tag, 
  CreditCard,
  MapPin,
  Globe,
  Save,
  X,
  Edit2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { leadService } from '@/services/leadService';
import { toast } from 'sonner';

interface LeadDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
  onUpdate?: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  landing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  referido: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  google_form: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
};

export const LeadDetailsModal: React.FC<LeadDetailsModalProps> = ({
  isOpen,
  onClose,
  lead,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (lead) {
      setFormData({
        contact_name: lead.contact_name || '',
        business_name: lead.business_name || '',
        phone_whatsapp: lead.phone_whatsapp || '',
        email: lead.email || '',
        source: lead.source || '',
        plan_interest: lead.plan_interest || '',
        city: lead.city || '',
        orders_per_day: lead.orders_per_day || '',
        courier: lead.courier || '',
        interested_in: lead.interested_in || '',
        assigned_to: lead.assigned_to || '',
        observations: lead.observations || '',
      });
    }
  }, [lead]);

  if (!lead) return null;

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to lead values
    setFormData({
      contact_name: lead.contact_name || '',
      business_name: lead.business_name || '',
      phone_whatsapp: lead.phone_whatsapp || '',
      email: lead.email || '',
      source: lead.source || '',
      plan_interest: lead.plan_interest || '',
      city: lead.city || '',
      orders_per_day: lead.orders_per_day || '',
      courier: lead.courier || '',
      interested_in: lead.interested_in || '',
      assigned_to: lead.assigned_to || '',
      observations: lead.observations || '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await leadService.updateLead(lead.id, formData);
      toast.success('Información actualizada correctamente');
      setIsEditing(false);
      if (onUpdate) onUpdate();
      // Optional: instead of reload, we could rely on onUpdate
      // but to be consistent with previous logic:
      window.location.reload();
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Error al actualizar el prospecto');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isEditing ? undefined : onClose}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {isEditing ? 'Editar Prospecto' : 'Detalles del Prospecto'}
            </DialogTitle>
            {!isEditing && (
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
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 scrollbar-hide max-h-[65vh] overflow-y-auto pr-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre de Contacto</label>
              {isEditing ? (
                <Input 
                  name="contact_name" 
                  value={formData.contact_name} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <User className="h-4 w-4 text-slate-400" />
                  {lead.contact_name}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Empresa / Negocio</label>
              {isEditing ? (
                <Input 
                  name="business_name" 
                  value={formData.business_name} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  {lead.business_name || 'No especificado'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">WhatsApp / Teléfono</label>
              {isEditing ? (
                <Input 
                  name="phone_whatsapp" 
                  value={formData.phone_whatsapp} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {lead.phone_whatsapp}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</label>
              {isEditing ? (
                <Input 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {lead.email || 'No especificado'}
                </div>
              )}
            </div>

            <div className="space-y-1 mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pedidos por día</label>
              {isEditing ? (
                <Input 
                  name="orders_per_day" 
                  type="number"
                  value={formData.orders_per_day} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <div className="h-4 w-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold">#</div>
                  {lead.orders_per_day || 'No especificado'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Courier preferido</label>
              {isEditing ? (
                <Input 
                  name="courier" 
                  value={formData.courier} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Globe className="h-4 w-4 text-slate-400" />
                  {lead.courier || 'No especificado'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsable (Vendedor)</label>
              {isEditing ? (
                <Input 
                  name="assigned_to" 
                  value={formData.assigned_to} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <User className="h-4 w-4 text-blue-400" />
                  {lead.assigned_to || 'Sin asignar'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fuente de Origen</label>
              {isEditing ? (
                <Input 
                  name="source" 
                  value={formData.source} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-slate-400" />
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "capitalize text-[10px] font-bold px-2 py-0.5 border-none",
                      SOURCE_COLORS[lead.source?.toLowerCase()] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {lead.source}
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plan de Interés</label>
              {isEditing ? (
                <Input 
                  name="plan_interest" 
                  value={formData.plan_interest} 
                  onChange={handleInputChange}
                  placeholder="e.g. Básico, Pro, Enterprise"
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  {lead.plan_interest ? (
                    <Badge variant="outline" className="uppercase text-[9px] font-black border-slate-200 dark:border-slate-700">
                      {lead.plan_interest}
                    </Badge>
                  ) : 'Pendiente'}
                </div>
              )}
            </div>

            <div className="space-y-1 mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Servicio de interés</label>
              {isEditing ? (
                <Input 
                  name="interested_in" 
                  value={formData.interested_in} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Tag className="h-4 w-4 text-slate-400" />
                  {lead.interested_in || 'No especificado'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ubicación / Ciudad</label>
              {isEditing ? (
                <Input 
                  name="city" 
                  value={formData.city} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {lead.city || 'No especificada'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observaciones</label>
              {isEditing ? (
                <Input 
                  name="observations" 
                  value={formData.observations} 
                  onChange={handleInputChange}
                  className="h-9 text-sm font-semibold"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Tag className="h-4 w-4 text-slate-400" />
                  {lead.observations || 'Sin observaciones adicionales'}
                </div>
              )}
            </div>

            {!isEditing && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha de Alta</label>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {new Date(lead.created_at).toLocaleDateString(undefined, { 
                    day: '2-digit', 
                    month: 'long', 
                    year: 'numeric'
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {lead.comments && !isEditing && (
          <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Comentarios iniciales</label>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
              &quot;{lead.comments}&quot;
            </p>
          </div>
        )}

        <DialogFooter className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full justify-end">
              <Button 
                onClick={handleCancel} 
                variant="ghost" 
                disabled={isSaving}
                className="text-[11px] font-black uppercase tracking-widest h-10 px-6 gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest h-10 px-8 gap-2"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar Cambios
              </Button>
            </div>
          ) : (
            <>
              <Button onClick={onClose} variant="secondary" className="text-[11px] font-black uppercase tracking-widest h-10 px-8">
                Cerrar
              </Button>
              <Button 
                onClick={handleEdit}
                className="bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-widest h-10 px-8 gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Editar Información
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
