"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw } from "lucide-react";
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
import { useReplaceSunatProfileCertificate } from "@/features/sunat/sunat-profile/hooks/use-replace-sunat-profile-certificate";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import {
  type ReplaceSunatProfileCertificateFormValues,
  replaceSunatProfileCertificateSchema,
} from "@/features/sunat/sunat-profile/schemas/replace-sunat-profile-certificate.schema";

interface CertificadoReplaceModalProps {
  /** The profile whose certificate is replaced. `null` closes the modal. */
  profile: SunatProfile | null;
  onClose: () => void;
}

export default function CertificadoReplaceModal({
  profile,
  onClose,
}: CertificadoReplaceModalProps) {
  const replaceCertificate = useReplaceSunatProfileCertificate();

  const form = useForm<ReplaceSunatProfileCertificateFormValues>({
    resolver: zodResolver(replaceSunatProfileCertificateSchema),
    defaultValues: { certificatePassword: "" },
  });

  function handleSubmit(values: ReplaceSunatProfileCertificateFormValues) {
    if (!profile) {
      return;
    }

    replaceCertificate.mutate(
      {
        id: profile.id,
        certificate: values.certificate,
        certificatePassword: values.certificatePassword,
      },
      {
        onSuccess: () => {
          form.reset({ certificatePassword: "" });
          onClose();
        },
      },
    );
  }

  function handleClose() {
    if (replaceCertificate.isPending) {
      return;
    }

    form.reset({ certificatePassword: "" });
    onClose();
  }

  return (
    <Dialog
      open={profile !== null}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className="h-5 w-5 text-primary" />
            Reemplazar certificado
          </DialogTitle>

          <DialogDescription>
            Sube el certificado correcto de{" "}
            <span className="font-semibold">{profile?.razonSocial}</span> (RUC {profile?.ruc}).
            Reemplaza al actual: tu RUC, usuario SOL, series y certificado predeterminado no
            cambian.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-5">
            <FormField
              control={form.control}
              name="certificatePassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña del certificado</FormLabel>

                  <FormControl>
                    <Input {...field} type="password" placeholder="Contraseña del certificado" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="certificate"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Certificado digital</FormLabel>

                  <FormControl>
                    <Input
                      {...field}
                      type="file"
                      accept=".p12,.pfx"
                      onChange={(event) => {
                        onChange(event.target.files?.[0]);
                      }}
                    />
                  </FormControl>

                  {value instanceof File && (
                    <p className="text-sm text-muted-foreground">{value.name}</p>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={replaceCertificate.isPending}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={replaceCertificate.isPending}>
                {replaceCertificate.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Validar y reemplazar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
