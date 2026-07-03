'use client';
import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { 
  Rocket, Loader2, Building2, User, Mail, ShieldCheck, 
  AlertTriangle, Phone, FileText, CheckCircle2, Copy 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPlatformUser, deleteUser } from "@/services/userService";
import { createCompany, deleteCompany } from "@/services/companyService";
import { createSubscription, cancelSubscription } from "@/services/subscriptionService";
import { createClient } from "@/utils/supabase/client";

interface LeadActivationFlowProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  token?: string;
  auth?: any;
  plans?: any[];
}

export const LeadActivationFlow: React.FC<LeadActivationFlowProps> = ({ 
  lead, open, onClose, token, auth, plans = [] 
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Extraemos nombre y apellido (asumiendo que contact_name tiene "nombre apellido")
  const splitName = (fullName: string) => {
    if (!fullName) return { name: '', surname: '' };
    const parts = fullName.split(' ');
    if (parts.length === 1) return { name: parts[0], surname: '' };
    return { name: parts[0], surname: parts.slice(1).join(' ') };
  };

  const [formData, setFormData] = useState({
    // User data
    name: '',
    surname: '',
    email: '',
    phoneNumber: lead?.phone_whatsapp || '',
    identityDocument: '00000000', // Valor por defecto o pedirlo
    
    // Company data
    businessName: lead?.business_name || '',
    ruc: '00000000000', // Valor por defecto
    address: '',
    
    // Additional data
    interestedIn: lead?.interested_in || lead?.plan_interest || '',
    ordersPerDay: lead?.orders_per_day || '',
    
    // Plan data
    planId: '',
  });

  const [generatedPassword, setGeneratedPassword] = useState('');

  useEffect(() => {
    if (lead) {
      const { name, surname } = splitName(lead.contact_name);
      
      // Password according to user request: Phone + Name (lowercase to satisfy backend regex)
      const pass = `${lead.phone_whatsapp || ''}${name || ''}`.replace(/\s/g, '').toLowerCase();
      setGeneratedPassword(pass);

      // Intentar pre-seleccionar el plan basado en lead.plan_interest
      let defaultPlan = '';
      if (lead.plan_interest && plans.length > 0) {
        const found = plans.find(p => p.name.toLowerCase().includes(lead.plan_interest.toLowerCase()));
        if (found) defaultPlan = found.id;
      }
      if (!defaultPlan && plans.length > 0) defaultPlan = plans[0].id;

      setFormData(prev => ({
        ...prev,
        businessName: lead.business_name || lead.lead?.business_name || '',
        name: name || '',
        surname: surname || '',
        email: lead.email || lead.lead?.email || '',
        phoneNumber: lead.phone_whatsapp || lead.lead?.phone_whatsapp || '',
        interestedIn: lead.interested_in || lead.plan_interest || lead.lead?.interested_in || lead.lead?.plan_interest || '',
        ordersPerDay: lead.orders_per_day || lead.lead?.orders_per_day || '',
        planId: defaultPlan,
      }));
    }
  }, [lead, plans]);

  const initOnboarding = async (businessId: string) => {
    const steps = [
      'business_profile',
      'store_config',
      'inventory_init',
      'first_order',
      'integrations',
      'final_training'
    ];
    
    const supabase = await createClient();
    const inserts = steps.map(step => ({
      business_id: businessId,
      step_code: step,
      completed: false,
      completion_pct: 0
    }));

    await supabase.from('onboarding_progress').insert(inserts);
  };

  const updateLeadStatus = async (businessId?: string, password?: string) => {
    if (!token) return;
    const activationId = lead.id;
    const leadId = lead.lead?.id || lead.lead_id || lead.id;

    // 1+2+4: PATCH activation → server route handles postventa insert and activity log
    // Uses service_role key (admin client), avoids RLS and the upsert onConflict 400s
    const activationRes = await fetch(`/api/superadmin/leads/activations/${activationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        activation_status: 'alta_completa',
        activation_date: new Date().toISOString(),
        temp_password: password || 'No disponible',
        business_id: businessId,
      }),
    });

    if (!activationRes.ok) {
      const err = await activationRes.json().catch(() => ({}));
      throw new Error(`Error al actualizar activación: ${err?.error || activationRes.statusText}`);
    }

    // 3. Actualizar lead principal a estado 'cerrado'
    const leadRes = await fetch(`/api/superadmin/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pipeline_stage: 'cerrado', business_id: businessId }),
    });

    if (!leadRes.ok) {
      const err = await leadRes.json().catch(() => ({}));
      // Non-fatal: log warning but don't abort — activation already saved
      console.warn('[updateLeadStatus] No se pudo cerrar el lead:', err?.error || leadRes.statusText);
    }
  };

  const executeActivation = async () => {
    if (!auth?.accessToken) {
      toast.error("Error de autenticación");
      return;
    }

    // --- VALIDACIÓN PREVIA AL ENVÍO ---
    const validationErrors: string[] = [];
    if (!formData.name.trim()) validationErrors.push('Nombre del administrador');
    if (!formData.surname.trim()) validationErrors.push('Apellido del administrador');
    if (!formData.email.trim()) validationErrors.push('Email');
    if (!formData.phoneNumber.trim()) validationErrors.push('Teléfono');
    if (!formData.identityDocument.trim()) validationErrors.push('Documento de identidad');
    if (!formData.businessName.trim()) validationErrors.push('Nombre del negocio');
    if (!formData.planId) validationErrors.push('Plan seleccionado');

    // Validar regex de password igual que el backend
    const passwordRegex = /^(?=.*[a-z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(generatedPassword)) {
      validationErrors.push(`Contraseña inválida ('${generatedPassword.slice(0,6)}...' - necesita mín. 6 chars, una minúscula, un número)`);
    }

    if (validationErrors.length > 0) {
      toast.error(`Completa los siguientes campos: ${validationErrors.join(' | ')}`);
      console.warn('[executeActivation] Validación fallida:', validationErrors);
      return;
    }
    
    setIsLoading(true);
    let createdUserId = '';
    let createdSubscriptionId = '';
    let createdBusinessId = '';

    try {
      // 1. Create User
      const userPayload = {
        name: formData.name || 'Admin',
        surname: formData.surname || 'Usuario',
        email: formData.email,
        username: formData.email,
        password: generatedPassword,
        phoneNumber: formData.phoneNumber || '000000000',
        identityDocument: formData.identityDocument || '00000000',
        address: formData.address || 'Calle Principal 123',
        department: 'LIMA',
        province: 'LIMA',
        district: 'LIMA',
        roleName: 'ADMINISTRADOR',
      };
      
      const createdUser = await createPlatformUser(userPayload, auth.accessToken);
      createdUserId = createdUser?.userId || createdUser?.id || createdUser?.user?.id;
      
      if (!createdUserId) throw new Error(`No se pudo obtener el ID del usuario creado. Respuesta: ${JSON.stringify(createdUser)}`);

      // 2. Create Subscription (non-blocking — si falla, continúa con la empresa)
      if (formData.planId) {
        const subPayload = {
          userId: createdUserId,
          planId: formData.planId,
          payerEmail: formData.email,
          status: 'ACTIVE',
        };
        try {
          const sub = await createSubscription(auth.accessToken, subPayload);
          createdSubscriptionId = sub?.id;
        } catch (subErr: any) {
          const subErrData = subErr?.response?.data;
          const subErrStatus = subErr?.response?.status;
          console.error("[LeadActivation] Error ms-subscription (status:", subErrStatus, "):", subErrData);
          // No abortamos el flujo completo, lo marcamos con warning
          toast.warning(`Suscripción no creada (${subErrStatus}): ${subErrData?.message || subErr.message}. El alta continuará sin plan asignado.`);
          // No relanzar — seguir con la empresa
        }
      }

      // 3. Create Business
      const companyPayload = {
        name: formData.businessName,
        userId: createdUserId,
        cuit: formData.ruc,
        phone: formData.phoneNumber,
        billingAddress: formData.address || 'Pendiente',
        billingEmail: formData.email,
      };
      try {
        const company = await createCompany(auth.accessToken, companyPayload);
        createdBusinessId = company?.id;
      } catch (compErr: any) {
        const compErrData = compErr?.response?.data;
        throw new Error(`Error al crear empresa: ${compErrData?.message || JSON.stringify(compErrData) || compErr.message}`);
      }
      
      if (!createdBusinessId) throw new Error("Error al crear la empresa: respuesta sin ID");

      // Platform entities created — show success immediately
      toast.success("¡Alta completada! Consulta las credenciales en Postventa.");

      // CRM side-effects: non-critical — don't roll back platform entities if these fail
      try {
        await initOnboarding(createdBusinessId);
        await updateLeadStatus(createdBusinessId, generatedPassword);
      } catch (crmErr: any) {
        console.error("[LeadActivation] Error actualizando estado CRM:", crmErr);
        toast.warning(`Alta creada, pero el estado del lead no se pudo actualizar: ${crmErr.message}`);
      }

      startTransition(() => {
        router.refresh();
        onClose();
      });

    } catch (error: any) {
      console.error("[LeadActivation] Error en flujo de alta:", error);

      // ROLLBACK platform entities (user/subscription/company creation failed)
      try {
        if (createdBusinessId) await deleteCompany(auth.accessToken, createdBusinessId);
        if (createdSubscriptionId) await cancelSubscription(auth.accessToken, createdSubscriptionId);
        if (createdUserId) await deleteUser(createdUserId, auth.accessToken);
      } catch (rollbackError) {
        console.error("[LeadActivation] Error during rollback:", rollbackError);
      }

      const displayMessage = error?.message || error?.response?.data?.message || 'Error desconocido';
      toast.error(`Error en alta: ${displayMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-gray-950">
        <div className="bg-emerald-600 p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
            <Rocket className="h-24 w-24" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-100/80">
                Onboarding Automático
              </span>
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white leading-tight">
              Dar de Alta a {lead.business_name}
            </DialogTitle>
            <DialogDescription className="text-emerald-50/80 text-sm mt-1">
              {step === 1 && "Paso 1: Datos del Administrador"}
              {step === 2 && "Paso 2: Datos de la Empresa"}
              {step === 3 && "Paso 3: Selección de Plan"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nombre</Label>
                  <Input 
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Apellido</Label>
                  <Input 
                    value={formData.surname}
                    onChange={e => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email (Acceso)</Label>
                <Input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Teléfono</Label>
                  <Input 
                    value={formData.phoneNumber}
                    onChange={e => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">DNI / Documento</Label>
                  <Input 
                    value={formData.identityDocument}
                    onChange={e => setFormData(prev => ({ ...prev, identityDocument: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Razón Social / Negocio</Label>
                <Input 
                  value={formData.businessName}
                  onChange={e => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">RUC / NIT</Label>
                <Input 
                  value={formData.ruc}
                  onChange={e => setFormData(prev => ({ ...prev, ruc: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Dirección Fiscal / Sede (Opcional)</Label>
                <Input 
                  value={formData.address}
                  onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Ej. Av. Principal 123"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div className="space-y-3">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Seleccionar Plan a Crear</Label>
                <div className="grid grid-cols-1 gap-2">
                  {plans.map(plan => (
                    <div 
                      key={plan.id}
                      onClick={() => setFormData(prev => ({ ...prev, planId: plan.id }))}
                      className={cn(
                        "p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between",
                        formData.planId === plan.id 
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10" 
                          : "border-gray-100 dark:border-gray-800 hover:border-emerald-200"
                      )}
                    >
                      <div>
                        <div className="font-bold text-sm">{plan.name}</div>
                        <div className="text-xs text-gray-500">{plan.durationInDays} días</div>
                      </div>
                      <div className="font-black text-emerald-600">
                        ${plan.price}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-4 rounded-xl flex gap-3 mt-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                  Al confirmar, se creará el perfil de empresa, el usuario administrador y la suscripción en los microservicios correspondientes.
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <Button 
            variant="ghost" 
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="flex-[1] h-12 font-bold uppercase tracking-widest text-xs hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border-none"
          >
            {step === 1 ? "Cancelar" : "Atrás"}
          </Button>
          <Button 
            onClick={step === 3 ? executeActivation : () => setStep(s => s + 1)}
            disabled={isLoading}
            className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
          >
            {isLoading || isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : step === 3 ? (
              <Rocket className="h-4 w-4 mr-2" />
            ) : null}
            {isLoading || isPending ? 'Activando...' : step === 3 ? 'Confirmar Alta' : 'Siguiente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
