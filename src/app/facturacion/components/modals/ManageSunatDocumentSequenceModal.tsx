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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SUNAT_DOCUMENT_SEQUENCES,
  SUNAT_DOCUMENT_TYPE_LABELS,
  SUNAT_DOCUMENT_TYPE_OPTIONS,
  type SunatDocumentType,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useInitializeSunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/hooks/use-initialize-sunat-document-sequence";
import type { SunatDocumentSequence } from "@/features/sunat/sunat-document-sequence/models/sunat-document-sequence";
import { initializeSunatDocumentSequenceDefaultValues } from "@/features/sunat/sunat-document-sequence/schemas/initialize-sunat-document-sequence.defaults";
import {
  type InitializeSunatDocumentSequenceFormValues,
  initializeSunatDocumentSequenceSchema,
} from "@/features/sunat/sunat-document-sequence/schemas/initialize-sunat-document-sequence.schema";
import { suggestNextSeriesCode } from "@/features/sunat/sunat-document-sequence/utils/suggest-next-series.util";

interface ManageSunatDocumentSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The sequence being edited, if any (drives the last-correlative default). */
  sequence: SunatDocumentSequence | null;
  /**
   * A fixed (taxDocumentType, series) pair to manage - e.g. clicking
   * "Gestionar" on an existing row. `null` means the user is adding a
   * brand-new series (e.g. F002 alongside F001): the fields render as
   * editable Select/Input instead of static text.
   */
  definition: {
    taxDocumentType: SunatDocumentType;
    series: string;
  } | null;
  /**
   * Every sequence already configured, regardless of which row was
   * clicked. Used only in "add new series" mode, to (a) suggest the next
   * series code for the chosen document type, and (b) warn - without
   * blocking - if the typed combination already exists, since submitting
   * that combination edits the existing series' correlative instead of
   * creating a second one.
   */
  existingSequences: SunatDocumentSequence[];
}

export function ManageSunatDocumentSequenceModal({
  isOpen,
  onClose,
  sequence,
  definition,
  existingSequences,
}: ManageSunatDocumentSequenceModalProps) {
  const isAddingNewSeries = definition === null;

  const initializeSequence = useInitializeSunatDocumentSequence();

  const form = useForm<InitializeSunatDocumentSequenceFormValues>({
    resolver: zodResolver(initializeSunatDocumentSequenceSchema),
    defaultValues: initializeSunatDocumentSequenceDefaultValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (definition) {
      form.reset({
        taxDocumentType: definition.taxDocumentType,
        series: definition.series,
        // `nextCorrelative` is a number end-to-end now (it used to be
        // typed as `string` on the frontend DTO/model while the backend
        // always returned a number - the `Number(...)` cast previously
        // here was masking that mismatch rather than fixing it).
        lastCorrelative: sequence ? Math.max(0, sequence.nextCorrelative - 1) : undefined,
      });
    } else {
      form.reset(initializeSunatDocumentSequenceDefaultValues);
    }
  }, [isOpen, definition, sequence, form]);

  const watchedTaxDocumentType = form.watch("taxDocumentType");
  const watchedSeries = form.watch("series");

  // Once the user picks a document type (and hasn't typed a series yet),
  // suggest the next one in sequence for that type so they don't have to
  // work out "what comes after F001" themselves.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-run when the document type changes
  useEffect(() => {
    if (
      !isAddingNewSeries ||
      !watchedTaxDocumentType ||
      form.getFieldState("series", form.formState).isDirty
    ) {
      return;
    }

    const fallback =
      DEFAULT_SUNAT_DOCUMENT_SEQUENCES.find(
        (definitionOption) => definitionOption.taxDocumentType === watchedTaxDocumentType,
      )?.series ?? "";

    form.setValue(
      "series",
      suggestNextSeriesCode(existingSequences, watchedTaxDocumentType, fallback),
    );
  }, [isAddingNewSeries, watchedTaxDocumentType]);

  const duplicateWarning =
    isAddingNewSeries &&
    watchedTaxDocumentType &&
    watchedSeries &&
    existingSequences.some(
      (existing) =>
        existing.taxDocumentType === watchedTaxDocumentType && existing.series === watchedSeries,
    )
      ? `Ya existe una serie "${watchedSeries}" para ${SUNAT_DOCUMENT_TYPE_LABELS[watchedTaxDocumentType]}. Guardar actualizará su correlativo en vez de crear una serie nueva.`
      : null;

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
          <DialogTitle>
            {definition ? `Gestionar serie ${definition.series}` : "Agregar nueva serie"}
          </DialogTitle>

          <DialogDescription>
            {definition
              ? "Actualiza el último correlativo utilizado para mantener sincronizada la numeración."
              : "Elige el tipo de documento y la serie (por ejemplo F002) que quieres habilitar."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            {definition ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Tipo de documento</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {SUNAT_DOCUMENT_TYPE_LABELS[definition.taxDocumentType]}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium">Serie</p>

                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {definition.series}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxDocumentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de documento</FormLabel>

                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un tipo" />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          {SUNAT_DOCUMENT_TYPE_OPTIONS.map((option) => (
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

                <FormField
                  control={form.control}
                  name="series"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serie</FormLabel>

                      <FormControl>
                        <Input
                          {...field}
                          placeholder="F002"
                          maxLength={4}
                          className="font-mono uppercase"
                          onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {duplicateWarning && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                {duplicateWarning}
              </p>
            )}

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

                  {nextCorrelative !== null && watchedSeries && (
                    <p className="text-xs text-muted-foreground">
                      El siguiente correlativo será{" "}
                      <span className="font-mono font-semibold">
                        {watchedSeries}-{String(nextCorrelative).padStart(8, "0")}
                      </span>
                    </p>
                  )}
                </FormItem>
              )}
            />

            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">
                {isAddingNewSeries ? "¿Desde qué número empezar?" : "Mantén este valor actualizado"}
              </p>

              <p className="mt-1 text-muted-foreground">
                {isAddingNewSeries
                  ? "Si es una serie completamente nueva, ingresa 0. Si ya emitiste comprobantes con esta serie fuera de Powip, ingresa el último número utilizado."
                  : "Si emitiste comprobantes fuera de Powip, ingresa aquí el último número utilizado para continuar correctamente la numeración."}
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
                ) : isAddingNewSeries ? (
                  "Agregar serie"
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
