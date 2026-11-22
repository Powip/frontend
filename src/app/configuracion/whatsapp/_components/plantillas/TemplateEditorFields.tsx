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
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import {
  waButton,
  waCheckbox,
  waField,
  waHint,
  waInput,
  waLabel,
  waSelectTrigger,
  waSwitch,
  waTextarea,
} from "@/components/whatsapp/ui/wa-classes";
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
import { cn } from "@/lib/utils";
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
  const [usage, displayName, headerType, abEnabled, body, buttonText] = useWatch({
    control: form.control,
    name: ["usage", "displayName", "headerType", "abEnabled", "body", "buttonText"],
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
        <FormItem className={waField}>
          <div className="flex items-center justify-between gap-3">
            <FormLabel className={waLabel}>{label}</FormLabel>
            <span className="wa-num text-xs text-wa-muted" aria-hidden="true">
              {field.value?.length ?? 0} / {WHATSAPP_TEMPLATE_LIMITS.body}
            </span>
          </div>
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
              className={cn(waTextarea, name === "bodyB" && "min-h-[90px]")}
              onFocus={() => setMessageTarget(name)}
            />
          </FormControl>
          <FormDescription className={waHint}>
            {hint}
            <span className="sr-only">
              {" "}
              {field.value?.length} / {WHATSAPP_TEMPLATE_LIMITS.body} caracteres.
            </span>
          </FormDescription>
          <FormMessage className="text-xs text-wa-red" />
        </FormItem>
      )}
    />
  );

  return (
    <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
      <legend className="sr-only">Datos de la plantilla</legend>

      <div className="grid grid-cols-1 gap-3.5 min-[900px]:grid-cols-2">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem className={waField}>
              <FormLabel className={waLabel}>Nombre interno</FormLabel>
              <FormControl>
                <WaInput
                  {...field}
                  placeholder="Ej. Pedido en camino"
                  autoComplete="off"
                  className={waInput}
                />
              </FormControl>
              <FormDescription className={cn(waHint, "break-all")}>
                Se guarda como{" "}
                <code className="font-wa-mono text-wa-fg">{technicalName || "—"}</code>. Es el
                nombre que recibe Meta.
              </FormDescription>
              <FormMessage className="text-xs text-wa-red" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="usage"
          render={({ field }) => (
            <FormItem className={waField}>
              <FormLabel className={waLabel}>Se usa en</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value && value !== field.value)
                    handleUsageChange(value as WhatsAppTemplateUsage);
                }}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
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
              <FormMessage className="text-xs text-wa-red" />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 min-[900px]:grid-cols-2">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem className={waField}>
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
              <FormDescription className={waHint}>
                {WHATSAPP_TEMPLATE_CATEGORY_OPTIONS.find((option) => option.value === field.value)
                  ?.hint ?? ""}
              </FormDescription>
              <FormMessage className="text-xs text-wa-red" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem className={waField}>
              <FormLabel className={waLabel}>Idioma</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value && value !== field.value) field.onChange(value);
                }}
                disabled={readOnly}
              >
                <FormControl>
                  <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
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
              <FormMessage className="text-xs text-wa-red" />
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FormField
          control={form.control}
          name="headerType"
          render={({ field }) => (
            <FormItem className={waField}>
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
              <FormDescription className={waHint}>
                {allowsDocumentHeader
                  ? "El PDF del comprobante lo adjunta POWIP en cada envío; aquí no se sube ningún archivo."
                  : "El encabezado Documento PDF solo está disponible para «Comprobante emitido»."}
              </FormDescription>
              <FormMessage className="text-xs text-wa-red" />
            </FormItem>
          )}
        />

        {headerType === WHATSAPP_TEMPLATE_HEADER_TYPES.TEXT && (
          <FormField
            control={form.control}
            name="headerText"
            render={({ field }) => (
              <FormItem className={waField}>
                <FormLabel className="sr-only">Texto del encabezado</FormLabel>
                <FormControl>
                  <WaInput
                    {...field}
                    placeholder="Ej. 📦 Tu pedido va en camino"
                    maxLength={WHATSAPP_TEMPLATE_LIMITS.headerText * 2}
                    className={waInput}
                  />
                </FormControl>
                <FormDescription className={waHint}>
                  Admite una variable. {field.value?.length} / {WHATSAPP_TEMPLATE_LIMITS.headerText}{" "}
                  caracteres.
                </FormDescription>
                <FormMessage className="text-xs text-wa-red" />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        {messageField(
          "body",
          "Mensaje",
          "Usa *asteriscos* para negrita y _guiones bajos_ para cursiva.",
        )}
        {!readOnly && usageDefinition?.suggestion && !body.trim() && (
          <Button
            type="button"
            className={cn(waButton({ size: "sm" }), "self-start")}
            onClick={applySuggestion}
          >
            <Wand2 aria-hidden="true" />
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
          <FormItem className={waField}>
            <FormLabel className={waLabel}>
              Pie de mensaje <span className="text-xs font-normal text-wa-muted">(opcional)</span>
            </FormLabel>
            <FormControl>
              <WaInput
                {...field}
                maxLength={WHATSAPP_TEMPLATE_LIMITS.footer * 2}
                className={waInput}
              />
            </FormControl>
            <FormDescription className={waHint}>
              Sin variables. {field.value?.length} / {WHATSAPP_TEMPLATE_LIMITS.footer} caracteres.
            </FormDescription>
            <FormMessage className="text-xs text-wa-red" />
          </FormItem>
        )}
      />

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className={cn(waLabel, "mb-1.5 p-0")}>Botones</legend>
        <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <FormField
            control={form.control}
            name="buttonText"
            render={({ field }) => (
              <FormItem className="min-w-0 gap-1 space-y-0">
                <FormLabel className="sr-only">Texto del botón de enlace</FormLabel>
                <FormControl>
                  <WaInput
                    {...field}
                    maxLength={WHATSAPP_TEMPLATE_LIMITS.buttonText * 2}
                    className={waInput}
                  />
                </FormControl>
                <FormMessage className="text-xs text-wa-red" />
              </FormItem>
            )}
          />
          <div className="min-w-0">
            <Label htmlFor="template-button-url" className="sr-only">
              Enlace del botón
            </Label>
            <WaInput
              id="template-button-url"
              value={WHATSAPP_TEMPLATE_TRACKING_URL_LABEL}
              readOnly
              disabled
              aria-describedby="template-button-url-hint"
              className={waInput}
            />
          </div>
          <WaPill tone="ok" className="justify-self-start">
            Rastreo POWIP
          </WaPill>
        </div>
        <p className={cn(waHint, "m-0")}>
          Abrir enlace · {buttonText.length} / {WHATSAPP_TEMPLATE_LIMITS.buttonText} caracteres en
          el texto del botón.{" "}
          <span id="template-button-url-hint">
            El enlace es fijo: rastreo POWIP. No se puede editar.
          </span>
        </p>
        <FormField
          control={form.control}
          name="quickReply"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  className={waCheckbox}
                  checked={field.value}
                  onCheckedChange={(checked) => setFieldValue("quickReply", checked === true)}
                />
              </FormControl>
              <FormLabel className="text-xs font-normal text-wa-fg">
                Agregar botón de respuesta «{WHATSAPP_TEMPLATE_QUICK_REPLY_TEXT}»
              </FormLabel>
            </FormItem>
          )}
        />
      </fieldset>

      <div className="flex flex-col gap-2">
        <FormField
          control={form.control}
          name="abEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <FormLabel className="text-sm font-medium text-wa-fg">
                  Probar dos versiones (A/B)
                </FormLabel>
                <FormDescription className={waHint}>
                  La mitad de los pedidos recibe cada versión. POWIP elige la ganadora con los
                  envíos reales; aquí no se muestran resultados.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  className={waSwitch}
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
                <FormItem className="flex flex-col gap-1 space-y-0">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="text-wa-muted" aria-hidden="true">
                      Elegir ganadora después de
                    </span>
                    <FormLabel className="sr-only">
                      Elegir ganadora después de (envíos por versión)
                    </FormLabel>
                    <FormControl>
                      <WaInput
                        {...field}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className={cn(waInput, "wa-num w-[70px] px-2 py-[5px] text-center")}
                      />
                    </FormControl>
                    <span className="text-wa-muted" aria-hidden="true">
                      envíos por versión
                    </span>
                  </div>
                  <FormMessage className="text-xs text-wa-red" />
                </FormItem>
              )}
            />
          </>
        )}
      </div>
    </fieldset>
  );
}
