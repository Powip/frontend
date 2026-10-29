"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useRegisterReferral } from "@/features/partners/hooks/use-register-referral";
import { toRegisterReferralRequestDto } from "@/features/partners/mappers/to-register-referral-request-dto";
import { registerReferralDefaultValues } from "@/features/partners/schemas/register-referral.defaults";
import {
  registerReferralSchema,
  type RegisterReferralFormValues,
} from "@/features/partners/schemas/register-referral.schema";
import {
  confirmManualReferralRetryKey,
  resolveManualReferralRetryKey,
} from "@/features/partners/utils/manual-referral-idempotency";

interface RegisterReferralDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RegisterReferralDialog({ isOpen, onClose }: RegisterReferralDialogProps) {
  const { auth } = useAuth();
  const userId = auth?.user.id;
  const registerReferral = useRegisterReferral();
  const [isPreparingKey, setIsPreparingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [confirmedButUncleared, setConfirmedButUncleared] = useState(false);
  const preparingRef = useRef(false);
  const mountedRef = useRef(true);
  const isBusy = isPreparingKey || registerReferral.isPending;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const form = useForm<RegisterReferralFormValues>({
    resolver: zodResolver(registerReferralSchema),
    defaultValues: registerReferralDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    form.reset(registerReferralDefaultValues);
  }, [isOpen, form]);

  async function handleSubmit(values: RegisterReferralFormValues) {
    if (preparingRef.current || registerReferral.isPending || confirmedButUncleared) return;
    preparingRef.current = true;
    setIsPreparingKey(true);
    setKeyError(null);
    const requestDto = toRegisterReferralRequestDto(values);
    try {
      const retryKey = await resolveManualReferralRetryKey(userId, requestDto);
      if (!mountedRef.current || !userId) return;
      registerReferral.mutate(
        { values, idempotencyKey: retryKey.key },
        {
          onSuccess: () => {
            try {
              confirmManualReferralRetryKey(userId, retryKey);
            } catch (error) {
              setConfirmedButUncleared(true);
              form.reset();
              setKeyError(
                `El referido ya fue registrado. ${error instanceof Error ? error.message : "No pudimos actualizar el registro seguro de reintentos."}`,
              );
              return;
            }
            form.reset();
            onClose();
          },
        },
      );
    } catch (error) {
      if (mountedRef.current) {
        setKeyError(
          `El referido no se envió. ${error instanceof Error ? error.message : "No pudimos asegurar su reintento."}`,
        );
      }
    } finally {
      preparingRef.current = false;
      if (mountedRef.current) setIsPreparingKey(false);
    }
  }

  function handleClose() {
    if (isBusy) {
      return;
    }
    form.reset();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Registrar referido</DialogTitle>
          <DialogDescription>
            El correo es la llave. Revisamos el registro antes de enviarle la invitación para
            activar su cuenta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del negocio</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Zapatería Andes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo del negocio</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="email"
                      placeholder="correo@negocio.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono / WhatsApp (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="+51 9·· ··· ···" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="register-referral-plan">Plan que le interesa</Label>
              <Select disabled>
                <SelectTrigger
                  id="register-referral-plan"
                  className="w-full"
                  aria-describedby="register-referral-plan-help"
                >
                  <SelectValue placeholder="No disponible por ahora" />
                </SelectTrigger>
                <SelectContent />
              </Select>
              <p id="register-referral-plan-help" className="text-xs text-muted-foreground">
                Todavía no podemos asociar un plan al referido porque falta el identificador del
                plan en el programa de partners. El referido se registra sin plan y el negocio lo
                elige al activar su cuenta.
              </p>
            </div>

            {keyError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{keyError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isBusy}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isBusy || confirmedButUncleared}>
                {isBusy ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    {isPreparingKey ? "Preparando..." : "Registrando..."}
                  </>
                ) : confirmedButUncleared ? (
                  "Registrado"
                ) : (
                  "Registrar referido"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
