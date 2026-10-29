"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PartnersRequestErrorAlert } from "@/components/partners/partners-request-error-alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useIdempotencyKey } from "@/features/partners/hooks/use-idempotency-key";
import { useRetryCooldown } from "@/features/partners/hooks/use-retry-cooldown";
import { useSubmitPartnerApplication } from "@/features/partners/hooks/use-submit-partner-application";
import { toFieldErrors } from "@/features/partners/mappers/to-field-errors";
import { toPartnersRequestError } from "@/features/partners/mappers/to-partners-request-error";
import { toSubmitPartnerApplicationRequestDto } from "@/features/partners/mappers/to-submit-partner-application-request-dto";
import type { SubmittedPartnerApplication } from "@/features/partners/models/submitted-partner-application";
import {
  PARTNER_APPLICATION_FIELDS,
  type SubmitPartnerApplicationFormValues,
  submitPartnerApplicationSchema,
} from "@/features/partners/schemas/submit-partner-application.schema";

export function PartnerApplicationForm() {
  const { auth } = useAuth();
  const submitApplication = useSubmitPartnerApplication();
  const idempotencyKey = useIdempotencyKey();
  const cooldown = useRetryCooldown();
  const [submitted, setSubmitted] = useState<SubmittedPartnerApplication | null>(null);

  const accountName = [auth?.user.name, auth?.user.surname].filter(Boolean).join(" ");

  const form = useForm<SubmitPartnerApplicationFormValues>({
    resolver: zodResolver(submitPartnerApplicationSchema),
    defaultValues: {
      email: auth?.user.email ?? "",
      legalName: "",
      contactName: accountName,
      phone: "",
      country: "",
    },
  });

  const accountEmail = auth?.user.email;

  useEffect(() => {
    if (accountEmail && !form.getFieldState("email").isDirty) {
      form.setValue("email", accountEmail);
    }
    if (accountName && !form.getFieldState("contactName").isDirty) {
      form.setValue("contactName", accountName);
    }
  }, [accountEmail, accountName, form]);

  const requestError = submitApplication.error
    ? toPartnersRequestError(submitApplication.error)
    : null;

  function handleSubmit(values: SubmitPartnerApplicationFormValues) {
    if (submitApplication.isPending || cooldown.isCoolingDown) return;

    const requestDto = toSubmitPartnerApplicationRequestDto(values);
    submitApplication.mutate(
      {
        values,
        idempotencyKey: idempotencyKey.resolve(requestDto),
      },
      {
        onSuccess: (application) => {
          idempotencyKey.reset(requestDto);
          setSubmitted(application);
        },
        onError: (error) => {
          const { retryAfterMs, kind, details } = toPartnersRequestError(error);
          if (retryAfterMs !== null) cooldown.start(retryAfterMs);
          if (kind !== "validation") return;
          const fieldErrors = toFieldErrors(details, PARTNER_APPLICATION_FIELDS);
          for (const field of PARTNER_APPLICATION_FIELDS) {
            const message = fieldErrors[field];
            if (message) form.setError(field, { type: "server", message });
          }
        },
      },
    );
  }

  if (submitted) {
    return (
      <Card role="status" className="mx-auto max-w-lg rounded-2xl">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Recibimos tu solicitud</h2>
          <p className="text-sm text-muted-foreground">
            Número de solicitud:{" "}
            <span className="font-mono font-semibold">{submitted.reference}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Para aprobarla necesitamos una cuenta Powip registrada y activa con el mismo correo de
            la solicitud. Cuando la aprobemos vas a poder entrar al portal de partners.
          </p>
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link href={auth ? "/partners" : "/login"}>
              {auth ? "Ir al portal de partners" : "Iniciar sesión"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg rounded-2xl">
      <CardHeader>
        <CardTitle>Solicitar ser partner</CardTitle>
        <CardDescription>
          Usá el correo de tu cuenta Powip: al aprobar la solicitud vinculamos esa cuenta con tu
          perfil de partner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="correo@ejemplo.com"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Tiene que coincidir con el de una cuenta Powip registrada y activa.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón social</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      placeholder="Ej. Partner Demo SAC"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de contacto</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Ej. Andrea Partner" {...field} />
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
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" placeholder="+51999999999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>País</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="country"
                      maxLength={2}
                      placeholder="PE"
                      className="uppercase"
                      {...field}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>Código ISO de dos letras, por ejemplo PE.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {requestError && (
              <PartnersRequestErrorAlert
                error={requestError}
                remainingMs={cooldown.remainingMs}
                fallbackMessage="No pudimos enviar tu solicitud. Intentá de nuevo."
              />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitApplication.isPending || cooldown.isCoolingDown}
            >
              {submitApplication.isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar solicitud"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
