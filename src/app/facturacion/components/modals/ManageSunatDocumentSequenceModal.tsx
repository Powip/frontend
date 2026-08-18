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
import type { SunatDocumentType } from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useInitializeSunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/hooks/use-initialize-sunat-document-sequence";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import { initializeSunatDocumentSequenceDefaultValues } from "@/features/sunat/sunat-document-sequence/schemas/initialize-sunat-document-sequence.defaults";
import {
  type InitializeSunatDocumentSequenceFormValues,
  initializeSunatDocumentSequenceSchema,
} from "@/features/sunat/sunat-document-sequence/schemas/initialize-sunat-document-sequence.schema";

interface ManageSunatDocumentSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sequence: SunatDocumentSequence | null;
  definition: {
    taxDocumentType: SunatDocumentType;
    series: string;
  } | null;
}

const SUNAT_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  "01": "Factura",
  "03": "Boleta de venta",
  "07": "Nota de crédito",
  "08": "Nota de débito",
};

export function ManageSunatDocumentSequenceModal({
  isOpen,
  onClose,
  sequence,
  definition,
}: ManageSunatDocumentSequenceModalProps) {
  const initializeSequence = useInitializeSunatDocumentSequence();

  const form = useForm<InitializeSunatDocumentSequenceFormValues>({
    resolver: zodResolver(initializeSunatDocumentSequenceSchema),
    defaultValues: initializeSunatDocumentSequenceDefaultValues,
  });

  useEffect(() => {
    if (!isOpen || !definition) {
      return;
    }

    form.reset({
      taxDocumentType: definition.taxDocumentType,
      series: definition.series,
      lastCorrelative: sequence ? Math.max(0, Number(sequence.nextCorrelative) - 1) : undefined,
    });
  }, [isOpen, definition, sequence, form]);

  function handleSubmit(values: InitializeSunatDocumentSequenceFormValues) {
    initializeSequence.mutate(values, {
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  }

  function handleClose() {
    if (initializeSequence.isPending) {
      return;
    }

    form.reset();
    onClose();
  }

  if (!definition) {
    return null;
  }

  const lastCorrelative = form.watch("lastCorrelative");
  const nextCorrelative = typeof lastCorrelative === "number" ? lastCorrelative + 1 : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Gestionar serie {definition.series}</DialogTitle>

          <DialogDescription>
            Actualiza el último correlativo utilizado para mantener sincronizada la numeración.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Tipo de documento</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {SUNAT_DOCUMENT_TYPE_LABELS[definition.taxDocumentType]}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium">Serie</p>

                <p className="mt-1 font-mono text-sm text-muted-foreground">{definition.series}</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="lastCorrelative"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Último correlativo utilizado</FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;

                        field.onChange(value === "" ? undefined : Number(value));
                      }}
                    />
                  </FormControl>

                  <FormMessage />

                  {nextCorrelative !== null && (
                    <p className="text-xs text-muted-foreground">
                      El siguiente correlativo será{" "}
                      <span className="font-mono font-semibold">
                        {definition.series}-{String(nextCorrelative).padStart(8, "0")}
                      </span>
                    </p>
                  )}
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">Mantén este valor actualizado</p>

              <p className="mt-1 text-muted-foreground">
                Si emitiste comprobantes fuera de Powip, ingresa aquí el último número utilizado
                para continuar correctamente la numeración.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={initializeSequence.isPending}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={initializeSequence.isPending}>
                {initializeSequence.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
