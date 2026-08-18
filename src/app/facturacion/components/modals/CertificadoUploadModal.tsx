"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_CODES } from "@/features/sunat/shared/enums/sunat.enums";
import { useCreateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-create-sunat-profile";
import { toCreateSunatProfileRequestDto } from "@/features/sunat/sunat-profile/mappers/to-create-sunat-profile.request.dto";
import { createSunatProfileDefaultValues } from "@/features/sunat/sunat-profile/schemas/create-sunat-profile.defaults";
import {
  type CreateSunatProfileFormValues,
  createSunatProfileSchema,
} from "@/features/sunat/sunat-profile/schemas/create-sunat-profile.schema";

interface CertificadoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CertificadoUploadModal({ isOpen, onClose }: CertificadoUploadModalProps) {
  const createSunatProfile = useCreateSunatProfile();

  const form = useForm<CreateSunatProfileFormValues>({
    resolver: zodResolver(createSunatProfileSchema),
    defaultValues: createSunatProfileDefaultValues,
    mode: "onBlur",
  });

  function handleSubmit(values: CreateSunatProfileFormValues) {
    const request = toCreateSunatProfileRequestDto(values);

    createSunatProfile.mutate(request, {
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  }

  function handleClose() {
    if (createSunatProfile.isPending) {
      return;
    }

    form.reset();
    onClose();
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Subir Certificado Digital
          </DialogTitle>

          <DialogDescription>
            Configura las credenciales y el certificado digital de tu perfil SUNAT.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5">
                {/* name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del perfil</FormLabel>

                      <FormControl>
                        <Input {...field} placeholder="Ej. Perfil SUNAT principal" />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* razonSocial + ruc */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="razonSocial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razón Social</FormLabel>

                        <FormControl>
                          <Input {...field} placeholder="Mi Empresa S.A.C." />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ruc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RUC</FormLabel>

                        <FormControl>
                          <Input {...field} placeholder="20xxxxxxxxx" />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* countryCode */}
                <FormField
                  control={form.control}
                  name="countryCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País</FormLabel>

                      <Select
                        value={field.value ?? COUNTRY_CODES.PERU}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un país" />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          <SelectItem value="PE">Perú</SelectItem>

                          <SelectItem value="EC">Ecuador</SelectItem>
                        </SelectContent>
                      </Select>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ubigeo + establishmentCode */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="ubigeo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubigeo</FormLabel>

                        <FormControl>
                          <Input {...field} placeholder="150101" />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="establishmentCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de establecimiento</FormLabel>

                        <FormControl>
                          <Input {...field} placeholder="0000" />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* address */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>

                      <FormControl>
                        <Input {...field} placeholder="Av. Principal 123" />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>

                      <FormControl>
                        <Input {...field} placeholder="Descripción opcional" />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* solUser */}
                <FormField
                  control={form.control}
                  name="solUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario SOL</FormLabel>

                      <FormControl>
                        <Input {...field} placeholder="Usuario SOL" />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* solPassword */}
                <FormField
                  control={form.control}
                  name="solPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clave SOL</FormLabel>

                      <FormControl>
                        <Input {...field} type="password" placeholder="Clave SOL" />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* certificatePassword */}
                <FormField
                  control={form.control}
                  name="certificatePassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña del certificado</FormLabel>

                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Contraseña del certificado"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* certificate */}
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
                            const file = event.target.files?.[0];

                            onChange(file);
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

                {/* logo */}
                <FormField
                  control={form.control}
                  name="logo"
                  render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                      <FormLabel>
                        Logo <span className="text-muted-foreground">(opcional)</span>
                      </FormLabel>

                      <FormControl>
                        <Input
                          {...field}
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];

                            onChange(file);
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
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={createSunatProfile.isPending}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={createSunatProfile.isPending}>
                {createSunatProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Validar y guardar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
