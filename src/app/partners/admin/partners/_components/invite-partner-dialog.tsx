"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { AdminReadError } from "../../_components/admin-read-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInviteAdminPartner } from "@/features/partners/hooks/use-invite-admin-partner";
import {
  PARTNER_PROFILE_OPTIONS,
  inviteAdminPartnerSchema,
  type InviteAdminPartnerFormValues,
} from "@/features/partners/schemas/invite-admin-partner.schema";

interface InvitePartnerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvitePartnerDialog({ isOpen, onClose }: InvitePartnerDialogProps) {
  const inviteAdminPartner = useInviteAdminPartner();
  const { session, mutation, mutationForSession } = inviteAdminPartner;
  const pending = mutationForSession && mutation.isPending;
  const uncertain = mutationForSession && mutation.isError;
  const locked = pending || uncertain || !session.enabled;

  const form = useForm<InviteAdminPartnerFormValues>({
    resolver: zodResolver(inviteAdminPartnerSchema),
    defaultValues: { name: "", email: "", profile: "agencia" },
  });

  useEffect(() => {
    if (!isOpen) return;
    form.reset({ name: "", email: "", profile: "agencia" });
  }, [isOpen, form]);

  function handleSubmit(values: InviteAdminPartnerFormValues) {
    if (!locked) inviteAdminPartner.write({ operation: "create", form: values });
  }

  function handleClose() {
    if (pending) return;
    form.reset();
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar partner</DialogTitle>
          <DialogDescription>
            Guarda una invitación y la encola para correo. No activa un partner ni asigna
            condiciones financieras.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {!session.canAccess ? (
              <p role="alert">Necesitás PARTNERS_APPROVE para invitar.</p>
            ) : null}
            {session.denied ? (
              <AdminReadError
                error={session.denied}
                message="Tu autorización actual no permite invitar."
              />
            ) : null}
            {uncertain && !session.denied ? (
              <AdminReadError
                error={mutation.error}
                message="No pudimos confirmar la invitación. Conservamos la misma solicitud para reintentar."
              />
            ) : null}
            {mutationForSession && mutation.isSuccess && session.enabled ? (
              <p role="status">
                Invitación encolada. No es confirmación de entrega ni de aprobación del partner.
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre / marca</FormLabel>
                  <FormControl>
                    <Input
                      disabled={locked}
                      maxLength={160}
                      placeholder="Nombre o marca"
                      {...field}
                    />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      disabled={locked}
                      maxLength={320}
                      inputMode="email"
                      placeholder="correo@ejemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="profile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil</FormLabel>
                  <Select disabled={locked} onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARTNER_PROFILE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose} disabled={pending}>
                Cerrar
              </Button>
              {uncertain ? (
                <Button
                  type="button"
                  disabled={!session.enabled || pending}
                  onClick={() => {
                    const original = mutation.variables;
                    if (original && mutationForSession) mutation.mutate(original);
                  }}
                >
                  Reintentar misma invitación
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={locked || (mutationForSession && mutation.isSuccess)}
                >
                  {pending ? (
                    <>
                      <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Encolar invitación"
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
