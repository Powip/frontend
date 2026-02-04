"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, Send } from "lucide-react";
import { toast } from "sonner";

interface EnterpriseContactModalProps {
  open: boolean;
  onClose: () => void;
}

export default function EnterpriseContactModal({
  open,
  onClose,
}: EnterpriseContactModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { name, company, email, message } = formData;

    // Validar campos básicos
    if (!name || !company || !email) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    const subject = encodeURIComponent(
      `Solicitud Plan Enterprise - ${company}`,
    );
    const body = encodeURIComponent(
      `Nombre: ${name}\nEmpresa: ${company}\nEmail de contacto: ${email}\n\nMensaje:\n${message}`,
    );

    const mailtoLink = `mailto:powipsystem@gmail.com?subject=${subject}&body=${body}`;

    window.location.href = mailtoLink;

    toast.success("Abriendo cliente de correo...");
    onClose();

    // Resetear form
    setFormData({
      name: "",
      company: "",
      email: "",
      message: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle>Contacto Plan Enterprise</DialogTitle>
          </div>
          <DialogDescription>
            Cuéntanos sobre las necesidades de tu empresa y nos pondremos en
            contacto contigo a la brevedad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de contacto *</Label>
              <Input
                id="name"
                placeholder="Tu nombre"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Empresa *</Label>
              <Input
                id="company"
                placeholder="Nombre de tu empresa"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email de contacto *</Label>
            <Input
              id="email"
              type="email"
              placeholder="correo@empresa.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">¿Cómo podemos ayudarte?</Label>
            <Textarea
              id="message"
              placeholder="Describe los requerimientos de tu empresa..."
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-2">
              <Send className="h-4 w-4" />
              Enviar solicitud
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
