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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token?: string;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    contact_name: '',
    business_name: '',
    phone_whatsapp: '',
    email: '',
    source: 'otro',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_name || !formData.phone_whatsapp) {
      toast.error('Nombre y WhatsApp son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/superadmin/leads', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al crear lead');
      }

      toast.success('Lead creado con éxito');
      onSuccess();
      setFormData({
        contact_name: '',
        business_name: '',
        phone_whatsapp: '',
        email: '',
        source: 'otro',
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Nuevo Prospecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
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
          <div className="space-y-2">
            <Label htmlFor="phone_whatsapp" className="text-[10px] font-bold uppercase text-slate-500">WhatsApp / Teléfono *</Label>
            <Input
              id="phone_whatsapp"
              placeholder="Ej: +51 987654321"
              value={formData.phone_whatsapp}
              onChange={(e) => setFormData({ ...formData, phone_whatsapp: e.target.value })}
              className="h-10 text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-bold uppercase text-slate-500">Email (Opcional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="ejemplo@correo.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source" className="text-[10px] font-bold uppercase text-slate-500">Fuente de Adquisición</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value })}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Selecciona una fuente" />
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
          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-primary/20">
              {loading ? 'Guardando...' : 'Crear Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
