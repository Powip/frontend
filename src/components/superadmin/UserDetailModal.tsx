"use client";

import React, { useState, useEffect } from "react";
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
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  CreditCard,
  Edit2,
  Save,
  X,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import ActionButton from "@/components/ui/action-button";
import { updateUser } from "@/services/userService";
import { 
  getSubscriptionByUserId, 
  createSubscription, 
  cancelSubscription 
} from "@/services/subscriptionService";

interface UserDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  auth: any;
  roles: any[];
  companies: any[];
  plans: any[];
  onSaveSuccess: () => void;
}

export function UserDetailModal({
  isOpen,
  onOpenChange,
  user,
  auth,
  roles,
  companies,
  plans,
  onSaveSuccess,
}: UserDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        name: user.name || "",
        surname: user.surname || "",
        address: user.address || "",
        city: user.city || user.department || "",
        province: user.province || "",
        district: user.district || "",
        phoneNumber: user.phoneNumber || "",
        roleName: user.roleName || "user",
        companyId: user.companyId || "none",
      });
      fetchSubscription();
    }
  }, [isOpen, user]);

  const fetchSubscription = async () => {
    if (!user?.id || !auth?.accessToken) return;
    setLoadingSub(true);
    try {
      const subs = await getSubscriptionByUserId(auth.accessToken, user.id);
      setSubscription(subs.length > 0 ? subs[0] : null);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoadingSub(false);
    }
  };

  const handleUpdate = async () => {
    if (!user?.id || !auth?.accessToken) return;
    setLoading(true);
    try {
      const payload = { ...formData };
      if (payload.companyId === "none") payload.companyId = null;
      await updateUser(user.id, payload, auth.accessToken);
      toast.success("Usuario actualizado");
      setEditing(false);
      onSaveSuccess?.();
    } catch (error) {
      toast.error("Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSub = async () => {
    if (!subscription?.id || !auth?.accessToken) return;
    setLoadingSub(true);
    try {
      await cancelSubscription(auth.accessToken, subscription.id);
      toast.success("Suscripción cancelada");
      fetchSubscription();
      onSaveSuccess?.();
    } catch (error) {
      toast.error("Error al cancelar");
    } finally {
      setLoadingSub(false);
    }
  };

  if (!formData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] bg-[#0f1117] border-white/10 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-xl font-bold">
                {user?.name?.[0]}{user?.surname?.[0] || user?.email?.[0].toUpperCase()}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {user?.name} {user?.surname}
                </DialogTitle>
                <DialogDescription className="text-gray-400 flex items-center gap-2">
                  <Mail className="h-3 w-3" /> {user?.email}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 border-white/10 ${editing ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-white/5 text-gray-300'}`}
              onClick={() => setEditing(!editing)}
            >
              {editing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              {editing ? 'Cancelar' : 'Editar'}
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                <User className="h-3 w-3" /> Datos de Identidad
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Nombre</Label>
                  <Input 
                    disabled={!editing}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="bg-white/5 border-white/10 disabled:opacity-80"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Apellido</Label>
                  <Input 
                    disabled={!editing}
                    value={formData.surname}
                    onChange={(e) => setFormData({...formData, surname: e.target.value})}
                    className="bg-white/5 border-white/10 disabled:opacity-80"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Documento (DNI/RUC)</Label>
                <Input 
                  disabled
                  value={user?.identityDocument || "No registrado"}
                  className="bg-white/5 border-white/10 opacity-50"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Contacto y Ubicación
              </h3>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Teléfono</Label>
                <Input 
                  disabled={!editing}
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-400 text-xs">Dirección</Label>
                <Input 
                  disabled={!editing}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> Permisos y Empresa
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Rol en Plataforma</Label>
                  <Select
                    disabled={!editing}
                    value={formData.roleName}
                    onValueChange={(v) => setFormData({...formData, roleName: v})}
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
                  <Label className="text-gray-400 text-xs">Empresa Asignada</Label>
                  <Select
                    disabled={!editing}
                    value={formData.companyId}
                    onValueChange={(v) => setFormData({...formData, companyId: v})}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1c24] border-white/10 text-white max-h-[200px]">
                      <SelectItem value="none">Sin empresa</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                <CreditCard className="h-3 w-3" /> Estado de Suscripción
              </h3>
              
              {loadingSub ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                </div>
              ) : subscription ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-bold text-white">{subscription.plan?.name}</p>
                      <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Activa hasta {new Date(subscription.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-primary">S/ {subscription.plan?.price}</p>
                      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Costo Mensual</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-400 h-8 text-xs font-bold"
                    onClick={handleCancelSub}
                  >
                    Cancelar Suscripción
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-xs text-gray-500 italic">No tiene una suscripción activa</p>
                  <Button className="w-full bg-primary/20 text-primary hover:bg-primary/30 border-none h-9 text-xs font-bold">
                    Asignar Plan Manualmente
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {editing && (
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <ActionButton
              label="Guardar Cambios"
              loadingLabel="Guardando..."
              loading={loading}
              onClick={handleUpdate}
              className="px-8 bg-primary hover:bg-primary/90 text-white font-bold"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
