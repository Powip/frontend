'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import axiosAuth from '@/lib/axiosAuth';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '',
    business_name: '',
    phone_whatsapp: '',
    email: '',
    source: 'otro',
    orders_per_day: '',
    courier: '',
    interested_in: '',
    assigned_to: '',
    observations: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_name || !formData.phone_whatsapp) {
      toast.error('Nombre y WhatsApp son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        orders_per_day: formData.orders_per_day ? parseInt(formData.orders_per_day) : undefined,
      };

      await axiosAuth.post('/api/superadmin/leads', payload);

      toast.success('Lead creado con éxito');
      onSuccess();
      setFormData({
        contact_name: '',
        business_name: '',
        phone_whatsapp: '',
        email: '',
        source: 'otro',
        orders_per_day: '',
        courier: '',
        interested_in: '',
        assigned_to: '',
        observations: '',
      });
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nuevo Prospecto
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name" className="text-[10px] font-bold uppercase text-slate-500">Persona de Contacto *</Label>
              <Input
                id="contact_name"
                placeholder="Ej: Juan Pérez"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="h-10 text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business_name" className="text-[10px] font-bold uppercase text-slate-500">Nombre del Negocio</Label>
              <Input
                id="business_name"
                placeholder="Ej: Panadería El Sol"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_whatsapp" className="text-[10px] font-bold uppercase text-slate-500">WhatsApp / Celular *</Label>
              <Input
                id="phone_whatsapp"
                placeholder="+51 987654321"
                value={formData.phone_whatsapp}
                onChange={(e) => setFormData({ ...formData, phone_whatsapp: e.target.value })}
                className="h-10 text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase text-slate-500">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ejemplo@correo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Canal de Adquisición</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Seleccionar canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="landing">Landing Page</SelectItem>
                  <SelectItem value="referido">Referido</SelectItem>
                  <SelectItem value="google_form">Google Form</SelectItem>
                  <SelectItem value="otro">Otro / Directo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assigned_to" className="text-[10px] font-bold uppercase text-slate-500">Responsable</Label>
              <Input
                id="assigned_to"
                placeholder="Nombre del vendedor"
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orders_per_day" className="text-[10px] font-bold uppercase text-slate-500">Pedidos/día</Label>
              <Input
                id="orders_per_day"
                type="number"
                placeholder="Ej: 50"
                value={formData.orders_per_day}
                onChange={(e) => setFormData({ ...formData, orders_per_day: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courier" className="text-[10px] font-bold uppercase text-slate-500">Courier</Label>
              <Input
                id="courier"
                placeholder="Ej: Shalom"
                value={formData.courier}
                onChange={(e) => setFormData({ ...formData, courier: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interested_in" className="text-[10px] font-bold uppercase text-slate-500">Interesado en</Label>
              <Input
                id="interested_in"
                placeholder="Ej: Inventario"
                value={formData.interested_in}
                onChange={(e) => setFormData({ ...formData, interested_in: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations" className="text-[10px] font-bold uppercase text-slate-500">Observaciones</Label>
            <Textarea
              id="observations"
              placeholder="Notas adicionales sobre el prospecto..."
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="text-sm min-h-[60px] resize-none"
            />
          </div>

          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-primary/20 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {loading ? 'Guardando...' : 'Crear Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
