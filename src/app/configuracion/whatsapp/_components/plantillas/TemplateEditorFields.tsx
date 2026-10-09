"use client";

import { Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getTemplateUsageDefinition,
  WHATSAPP_TEMPLATE_CATEGORY_OPTIONS,
  WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS,
  WHATSAPP_TEMPLATE_LIMITS,
  WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT,
  WHATSAPP_TEMPLATE_TRACKING_URL_LABEL,
  WHATSAPP_TEMPLATE_USAGE_DEFINITIONS,
} from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_HEADER_TYPES,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateHeaderType,
  type WhatsAppTemplateUsage,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { TemplateEditorValues } from "@/features/whatsapp/schemas/template-editor.schema";
import { toTemplateTechnicalName } from "@/features/whatsapp/utils/template-name.util";
import {
  getAllowedTemplateVariables,
  insertTextAtSelection,
  toVariableToken,
} from "@/features/whatsapp/utils/template-variables.util";
import { TemplateSegmentedChoice } from "./TemplateSegmentedChoice";
import { TemplateVariableChips } from "./TemplateVariableChips";

type MessageField = "body" | "bodyB";

const MESSAGE_FIELD_LABELS: Record<MessageField, string> = {
  body: "Mensaje (versión A)",
  bodyB: "Mensaje de la versión B",
};

interface TemplateEditorFieldsProps {
  readOnly: boolean;
}

export function TemplateEditorFields({ readOnly }: TemplateEditorFieldsProps) {
  const form = useFormContext<TemplateEditorValues>();
  const [usage, displayName, headerType, abEnabled, body] = useWatch({
    control: form.control,
    name: ["usage", "displayName", "headerType", "abEnabled", "body"],
  });
  const [messageTarget, setMessageTarget] = useState<MessageField>("body");
  const messageRefs = useRef<Record<MessageField, HTMLTextAreaElement | null>>({
    body: null,
    bodyB: null,
  });

  const usageDefinition = getTemplateUsageDefinition(usage);
  const allowsDocumentHeader = usageDefinition?.allowsDocumentHeader ?? false;
  const technicalName = toTemplateTechnicalName(displayName);
  const activeTarget: MessageField = abEnabled ? messageTarget : "body";

  const setFieldValue = (name: keyof TemplateEditorValues, value: string | boolean) => {
    form.setValue(name, value as never, {
      shouldDirty: true,
      shouldValidate: form.getFieldState(name).isTouched || form.formState.isSubmitted,
    });
  };

  const insertVariable = (key: string) => {
    const element = messageRefs.current[activeTarget];
    const current = form.getValues(activeTarget);
    const result = insertTextAtSelection(
      current,
      element?.selectionStart,
      element?.selectionEnd,
      toVariableToken(key),
    );
    flushSync(() => setFieldValue(activeTarget, result.value));
    if (element) {
      element.focus();
      element.setSelectionRange(result.selectionStart, result.selectionEnd);
    }
  };

  const handleUsageChange = (value: WhatsAppTemplateUsage) => {
    setFieldValue("usage", value);
    if (
      form.getValues("headerType") === WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT &&
      !getTemplateUsageDefinition(value)?.allowsDocumentHeader
    ) {
      setFieldValue("headerType", WHATSAPP_TEMPLATE_HEADER_TYPES.NONE);
    }
    for (const field of ["body", "bodyB", "headerText"] as const) {
      if (form.getFieldState(field).isTouched) void form.trigger(field);
    }
  };

  const applySuggestion = () => {
    const suggestion = usageDefinition?.suggestion;
    if (!suggestion) return;
    setFieldValue("body", suggestion.body);
    setFieldValue("buttonText", suggestion.buttonText);
    if (allowsDocumentHeader) {
      setFieldValue("headerType", WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT);
    } else if (suggestion.headerText) {
      setFieldValue("headerType", WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT);
      setFieldValue("headerText", suggestion.headerText);
    }
  };

  const messageField = (name: MessageField, label: string, hint: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              ref={(element) => {
                field.ref(element);
                messageRefs.current[name] = element;
              }}
              rows={name === "body" ? 6 : 4}
              readOnly={readOnly}
              maxLength={WHATSAPP_TEMPLATE_LIMITS.body * 2}
              className="min-h-28 resize-y"
              onFocus={() => setMessageTarget(name)}
            />
          </FormControl>
          <FormDescription>
            {hint} {field.value.length} / {WHATSAPP_TEMPLATE_LIMITS.body} caracteres.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <fieldset disabled={readOnly} className="min-w-0 space-y-5">
      <legend className="sr-only">Datos de la plantilla</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel>Nombre interno</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej. Pedido en camino" autoComplete="off" />
              </FormControl>
              <FormDescription className="break-all">
                Se guarda como{" "}
                <code className="font-mono text-foreground">{technicalName || "—"}</code>. Es el
                nombre que recibe Meta.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="usage"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel>Se usa en</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value && value !== field.value)
                    handleUsageChange(value as WhatsAppTemplateUsage);
                }}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger className="w-full" onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WHATSAPP_TEMPLATE_USAGE_DEFINITIONS.map((definition) => (
                    <SelectItem key={definition.value} value={definition.value}>
                      {definition.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormControl>
                <TemplateSegmentedChoice
                  legend="Categoría"
                  name="template-category"
                  value={field.value}
                  options={WHATSAPP_TEMPLATE_CATEGORY_OPTIONS}
                  readOnly={readOnly}
                  onValueChange={(value: WhatsAppTemplateCategory) =>
                    setFieldValue("category", value)
                  }
                />
              </FormControl>
              <FormDescription>
                {WHATSAPP_TEMPLATE_CATEGORY_OPTIONS.find((option) => option.value === field.value)
                  ?.hint ?? ""}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel>Idioma</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value && value !== field.value) field.onChange(value);
                }}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger className="w-full" onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS.map((option) => (
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
      </div>

      <div className="space-y-3">
        <FormField
          control={form.control}
          name="headerType"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <TemplateSegmentedChoice
                  legend="Encabezado (opcional)"
                  name="template-header-type"
                  value={field.value}
                  readOnly={readOnly}
                  options={[
                    { value: WHATSAPP_TEMPLATE_HEADER_TYPES.NONE, label: "Ninguno" },
                    { value: WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT, label: "Texto" },
                    {
                      value: WHATSAPP_TEMPLATE_HEADER_TYPES.DOCUMENT,
                      label: "Documento PDF",
                      disabled: !allowsDocumentHeader,
                    },
                  ]}
                  onValueChange={(value: WhatsAppTemplateHeaderType) =>
                    setFieldValue("headerType", value)
                  }
                />
              </FormControl>
              <FormDescription>
                {allowsDocumentHeader
                  ? "El PDF del comprobante lo adjunta POWIP en cada envío; aquí no se sube ningún archivo."
                  : "El encabezado Documento PDF solo está disponible para «Comprobante emitido»."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT && (
          <FormField
            control={form.control}
            name="headerText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Texto del encabezado</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Ej. 📦 Tu pedido va en camino"
                    maxLength={WHATSAPP_TEMPLATE_LIMITS.headerText * 2}
                  />
                </FormControl>
                <FormDescription>
                  Admite una variable. {field.value.length} / {WHATSAPP_TEMPLATE_LIMITS.headerText}{" "}
                  caracteres.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="space-y-3">
        {messageField("body", "Mensaje", "Admite *negrita* y _cursiva_.")}
        {!readOnly && usageDefinition?.suggestion && !body.trim() && (
          <Button type="button" variant="outline" size="sm" onClick={applySuggestion}>
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            Usar texto sugerido para «{usageDefinition.label}»
          </Button>
        )}
        <TemplateVariableChips
          variables={getAllowedTemplateVariables(usage)}
          targetLabel={MESSAGE_FIELD_LABELS[activeTarget]}
          disabled={readOnly}
          onInsert={insertVariable}
        />
      </div>

      <FormField
        control={form.control}
        name="footer"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Pie de mensaje (opcional)</FormLabel>
            <FormControl>
              <Input {...field} maxLength={WHATSAPP_TEMPLATE_LIMITS.footer * 2} />
            </FormControl>
            <FormDescription>
              Sin variables. {field.value.length} / {WHATSAPP_TEMPLATE_LIMITS.footer} caracteres.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Botones</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="buttonText"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel>Texto del botón de enlace</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={WHATSAPP_TEMPLATE_LIMITS.buttonText * 2} />
                </FormControl>
                <FormDescription>
                  {field.value.length} / {WHATSAPP_TEMPLATE_LIMITS.buttonText} caracteres.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="min-w-0 space-y-2">
            <Label htmlFor="template-button-url">Enlace del botón</Label>
            <Input
              id="template-button-url"
              value={WHATSAPP_TEMPLATE_TRACKING_URL_LABEL}
              readOnly
              disabled
              aria-describedby="template-button-url-hint"
            />
            <p id="template-button-url-hint" className="text-sm text-muted-foreground">
              Fijo: rastreo POWIP. No se puede editar.
            </p>
          </div>
        </div>
        <FormField
          control={form.control}
          name="quickReply"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => setFieldValue("quickReply", checked === true)}
                />
              </FormControl>
              <FormLabel className="font-normal">
                Agregar botón de respuesta «{WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT}»
              </FormLabel>
            </FormItem>
          )}
        />
      </fieldset>

      <div className="space-y-3 rounded-lg border p-3">
        <FormField
          control={form.control}
          name="abEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0 space-y-1">
                <FormLabel>Probar dos versiones (A/B)</FormLabel>
                <FormDescription>
                  La mitad de los pedidos recibe cada versión. POWIP elige la ganadora con los
                  envíos reales; aquí no se muestran resultados.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    setFieldValue("abEnabled", checked);
                    if (!checked) setMessageTarget("body");
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
        {abEnabled && (
          <>
            {messageField("bodyB", "Mensaje de la versión B", "Mismas reglas que la versión A.")}
            <FormField
              control={form.control}
              name="abMinSendsPerVariant"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Elegir ganadora después de (envíos por versión)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" pattern="[0-9]*" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>
    </fieldset>
  );
}
