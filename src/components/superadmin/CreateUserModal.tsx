"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Check, UserPlus, CreditCard, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import ActionButton from "@/components/ui/action-button";
import { createCompanyUser, createPlatformUser } from "@/services/userService";
import { createSubscription } from "@/services/subscriptionService";
import { decodeToken } from "@/lib/jwt";

interface CreateUserModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  auth: any;
  roles: any[];
  companies: any[];
  plans: any[];
  onSaveSuccess: () => void;
}

export function CreateUserModal({
  isOpen,
  onOpenChange,
  auth,
  roles,
  companies,
  plans,
  onSaveSuccess,
}: CreateUserModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdUserEmail, setCreatedUserEmail] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    surname: "",
    identityDocument: "",
    phoneNumber: "",
    address: "",
    district: "",
    department: "",
    roleName: "user",
    companyId: "none",
  });

  const handleSave = async () => {
    if (!auth?.accessToken) return;
    setLoading(true);
    try {
      let result;
      const payload = { ...formData };
      if (payload.companyId === "none") delete (payload as any).companyId;

      if (formData.companyId && formData.companyId !== "none") {
        result = await createCompanyUser(formData.companyId, payload as any, auth.accessToken);
      } else {
        result = await createPlatformUser(payload as any, auth.accessToken);
      }

      const isAppAdmin = formData.roleName === "ADMINISTRADOR";

      if (isAppAdmin) {
        let userId = result?.id;
        if (!userId && result?.accessToken) {
          const decoded = decodeToken(result.accessToken);
          userId = decoded?.id;
        }

        if (userId) {
          setCreatedUserId(userId);
          setCreatedUserEmail(formData.email);
          setStep(2);
          toast.success("Usuario creado. Ahora configura su plan.");
          return;
        }
      }

      toast.success("Usuario creado con éxito");
      onOpenChange(false);
      onSaveSuccess?.();
    } catch (error) {
      toast.error("Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionSave = async () => {
    if (!auth?.accessToken || !createdUserId || !selectedPlanId || !createdUserEmail) return;
    setLoading(true);
    try {
      const response = await createSubscription(auth.accessToken, {
        userId: createdUserId,
        planId: selectedPlanId,
        payerEmail: createdUserEmail,
        status: "ACTIVE",
      });

      if (response && (response as any).initPoint) {
        window.location.href = (response as any).initPoint;
        return;
      }

      toast.success("Suscripción activada con éxito");
      onOpenChange(false);
      onSaveSuccess?.();
    } catch (error) {
      toast.error("Error al activar suscripción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setStep(1);
          setCreatedUserId(null);
          setSelectedPlanId(null);
          setFormData({
            email: "",
            password: "",
            name: "",
            surname: "",
            identityDocument: "",
            phoneNumber: "",
            address: "",
            district: "",
            department: "",
            roleName: "user",
            companyId: "none",
          });
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className={`${step === 2 ? "sm:max-w-[600px]" : "sm:max-w-[550px]"} bg-[#0f1117] border-white/10 text-white`}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${step === 1 ? 'bg-primary/20 text-primary' : 'bg-green-500/20 text-green-500'}`}>
              {step === 1 ? <UserPlus className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {step === 1 ? "Crear Nuevo Usuario" : "Configurar Suscripción"}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                {step === 1 ? "Registro manual de personal o administradores." : "Activa un plan para el nuevo administrador."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-4 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Nombre</Label>
                <Input
                  placeholder="Ej: Juan"
                  className="bg-white/5 border-white/10 focus:border-primary/50"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Apellido</Label>
                <Input
                  placeholder="Ej: Pérez"
                  className="bg-white/5 border-white/10"
                  value={formData.surname}
                  onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Email (Acceso)</Label>
              <Input
                type="email"
                placeholder="juan@empresa.com"
                className="bg-white/5 border-white/10"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Documento (DNI/RUC)</Label>
                <Input
                  className="bg-white/5 border-white/10"
                  value={formData.identityDocument}
                  onChange={(e) => setFormData({ ...formData, identityDocument: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Teléfono</Label>
                <Input
                  className="bg-white/5 border-white/10"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Rol</Label>
                <Select
                  value={formData.roleName}
                  onValueChange={(v) => setFormData({ ...formData, roleName: v })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1c24] border-white/10 text-white">
                    {roles.map((r) => (
                      <SelectItem key={r.id || r.name} value={r.name}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Empresa (Opcional)</Label>
                <Select
                  value={formData.companyId}
                  onValueChange={(v) => setFormData({ ...formData, companyId: v })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1c24] border-white/10 text-white max-h-[200px]">
                    <SelectItem value="none">Sin empresa (Plataforma)</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <ActionButton
                label="Crear Usuario"
                loadingLabel="Guardando..."
                loading={loading}
                className="w-full md:w-auto px-10 bg-primary hover:bg-primary/90 text-white font-bold"
                onClick={handleSave}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedPlanId === plan.id
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-white">{plan.name}</h4>
                    {selectedPlanId === plan.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-2xl font-black text-white/90">S/ {plan.price}</div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight mt-1">
                    {plan.durationInDays} DÍAS ACCESO
                  </p>
                </div>
              ))}
            </div>
            
            <div className="flex justify-between items-center gap-4 pt-4 border-t border-white/5">
              <Button
                variant="ghost"
                className="text-gray-500 hover:text-white"
                onClick={() => {
                  onOpenChange(false);
                  onSaveSuccess?.();
                }}
              >
                Omitir suscripción
              </Button>
              <ActionButton
                label="Activar y Finalizar"
                loadingLabel="Procesando..."
                loading={loading}
                disabled={!selectedPlanId}
                className="bg-green-600 hover:bg-green-500 text-white font-bold px-8"
                onClick={handleSubscriptionSave}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
