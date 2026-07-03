"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, Loader2, Check, Pencil } from "lucide-react";
import { updateDatosClienteCC } from "@/services/atencionClienteService";
import { toast } from "sonner";

interface CustomerData {
  province?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  reference?: string | null;
}

interface Props {
  orderId: string;
  dniCliente: string | null | undefined;
  customer: CustomerData | null | undefined;
  onDatosCompletos: () => void;
}

const JUNK_VALUES = new Set([
  "", "por completar", "-", "0", "s/d", "n/a", "na", "sd", "n/d", "nd",
  "none", "null", "no data", "sin dato", "sin datos",
  "lima_norte", "lima_centro", "lima_sur", "lima_este", "lima_oeste",
  "zonas_aledanas", "provincias",
]);

function isJunk(v: string | null | undefined): boolean {
  if (!v || !v.trim()) return true;
  return JUNK_VALUES.has(v.trim().toLowerCase());
}

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "tel";
  validate?: (v: string) => string | null;
  dtoKey: string;
}

const DNI_FIELD: FieldDef = {
  key: "dniCliente",
  label: "DNI del cliente",
  placeholder: "12345678",
  maxLength: 8,
  inputMode: "numeric",
  validate: (v) =>
    /^\d{8}$/.test(v) ? null : `Debe tener exactamente 8 dígitos (${v.length}/8)`,
  dtoKey: "dniCliente",
};

const LOCATION_FIELDS: FieldDef[] = [
  {
    key: "province",
    label: "Departamento",
    placeholder: "Ej: Lima",
    validate: (v) => isJunk(v) ? "Valor inválido — ingresá un dato real" : null,
    dtoKey: "province",
  },
  {
    key: "city",
    label: "Provincia",
    placeholder: "Ej: Lima",
    validate: (v) => isJunk(v) ? "Valor inválido — ingresá un dato real" : null,
    dtoKey: "city",
  },
  {
    key: "district",
    label: "Distrito",
    placeholder: "Ej: Miraflores",
    validate: (v) => isJunk(v) ? "Valor inválido — ingresá un dato real" : null,
    dtoKey: "district",
  },
  {
    key: "address",
    label: "Dirección",
    placeholder: "Ej: Jr. Las Flores 123",
    validate: (v) => isJunk(v) ? "Valor inválido — ingresá un dato real" : null,
    dtoKey: "address",
  },
];

function getInitialValues(
  dniCliente: string | null | undefined,
  customer: CustomerData | null | undefined,
): Record<string, string> {
  return {
    dniCliente: dniCliente ?? "",
    province: customer?.province ?? "",
    city: customer?.city ?? "",
    district: customer?.district ?? "",
    address: customer?.address ?? "",
    phoneNumber: customer?.phoneNumber ?? "",
  };
}

export function DatosIncompletosBlock({ orderId, dniCliente, customer, onDatosCompletos }: Props) {
  const [forceEdit, setForceEdit] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(
    getInitialValues(dniCliente, customer),
  );
  const [saving, setSaving] = useState(false);
  const [isCorrected, setIsCorrected] = useState(false);

  const dniEsJunk = useMemo(
    () => isJunk(dniCliente) || (!!dniCliente && !/^\d{8}$/.test(dniCliente.trim())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const dniActivo = dniEsJunk ? DNI_FIELD : null;

  // Solo campos de ubicación que realmente tienen valores inválidos
  const locationConProblemas = customer
    ? LOCATION_FIELDS.filter((f) =>
        isJunk(customer[f.key as keyof CustomerData] as string | null | undefined)
      )
    : [];

  const hasProblemas = dniActivo !== null || locationConProblemas.length > 0;

  // En modo forzado sin problemas reales: mostrar todos los campos de ubicación
  const camposActivos: FieldDef[] = hasProblemas
    ? [...(dniActivo ? [dniActivo] : []), ...locationConProblemas]
    : [...(dniActivo ? [dniActivo] : []), ...(customer ? LOCATION_FIELDS : [])];

  if (isCorrected) {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm font-bold text-green-800 dark:text-green-200">
            Datos actualizados correctamente
          </p>
        </div>
        <p className="text-xs text-green-600 dark:text-green-400 mb-3">
          Los datos del cliente han sido corregidos y guardados en el sistema.
        </p>
        <button
          type="button"
          onClick={() => setIsCorrected(false)}
          className="text-xs text-green-700 dark:text-green-400 underline underline-offset-2 hover:no-underline"
        >
          ¿Desea corregir otro dato?
        </button>
      </div>
    );
  }

  // Sin problemas y sin edición forzada: mostrar botón lápiz discreto
  if (!hasProblemas && !forceEdit) {
    return (
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setForceEdit(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Editar dirección
        </button>
      </div>
    );
  }

  if (camposActivos.length === 0) return null;

  const errores: Record<string, string | null> = {};
  for (const campo of camposActivos) {
    const v = values[campo.key] ?? "";
    errores[campo.key] = campo.validate ? campo.validate(v) : (v.trim().length === 0 ? "Campo requerido" : null);
  }
  const todosValidos = camposActivos.every((f) => errores[f.key] === null);

  async function handleGuardar() {
    if (!todosValidos) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = {};
      for (const campo of camposActivos) {
        payload[campo.dtoKey] = values[campo.key].trim();
      }
      await updateDatosClienteCC(orderId, payload);
      toast.success("Datos actualizados correctamente");
      setIsCorrected(true);
      setForceEdit(false);
      onDatosCompletos();
    } catch {
      toast.error("Error al guardar los datos — intentá de nuevo");
    } finally {
      setSaving(false);
    }
  }

  // Modo advertencia (datos realmente corruptos) vs modo edición silenciosa
  const isWarning = hasProblemas;

  return (
    <div className={`rounded-xl p-4 mb-4 border-2 ${
      isWarning
        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
        : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
    }`}>
      {/* Header */}
      {isWarning ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-bold text-red-800 dark:text-red-200">
              Datos incompletos o corruptos — corregir antes de continuar
            </p>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mb-4">
            Los campos marcados en rojo vinieron con valores inválidos del sistema de origen.
            Corregí cada campo y hacé clic en <strong>Actualizar Datos</strong>.
          </p>
        </>
      ) : (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Editar datos de entrega
          </p>
          <button
            type="button"
            onClick={() => setForceEdit(false)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-2"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="space-y-3">
        {camposActivos.map((campo) => {
          const v = values[campo.key] ?? "";
          const error = errores[campo.key];
          const isOk = error === null && v.trim().length > 0;
          const valorOriginal = campo.key === "dniCliente"
            ? dniCliente
            : customer?.[campo.key as keyof CustomerData];
          const originalEsBasura = isJunk(valorOriginal) && !!valorOriginal?.trim();

          const labelClass = isWarning
            ? "text-[11px] font-semibold text-red-800 dark:text-red-300 uppercase tracking-wide"
            : "text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide";

          return (
            <div key={campo.key}>
              <div className="flex items-center gap-2 mb-1">
                <label className={labelClass}>
                  {campo.label}
                </label>
                {originalEsBasura && (
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded font-mono">
                    era: &quot;{valorOriginal}&quot;
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode={campo.inputMode ?? "text"}
                  maxLength={campo.maxLength}
                  value={v}
                  onChange={(e) => {
                    const val = campo.inputMode === "numeric"
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value;
                    setValues((prev) => ({ ...prev, [campo.key]: val }));
                  }}
                  placeholder={campo.placeholder}
                  className={`w-full px-3 py-2 text-sm border-2 rounded-lg outline-none pr-8 transition-colors dark:text-slate-100
                    ${isOk
                      ? "border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600"
                      : error && v.length > 0
                        ? "border-red-400 bg-white dark:bg-slate-800 focus:border-red-500 dark:focus:border-red-400"
                        : isWarning
                          ? "border-red-300 bg-white dark:bg-slate-800 dark:border-red-700 focus:border-red-400"
                          : "border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 focus:border-slate-400"
                    }`}
                />
                {isOk && (
                  <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
                )}
              </div>
              {error && v.length > 0 && (
                <p className="text-[10px] text-red-500 mt-0.5">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={!todosValidos || saving}
          onClick={handleGuardar}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all
            ${todosValidos && !saving
              ? isWarning
                ? "bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                : "bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white cursor-pointer"
              : "bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
            }`}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : todosValidos ? (
            <>
              <Check className="h-4 w-4" />
              Actualizar Datos
            </>
          ) : (
            "Completá todos los campos para continuar"
          )}
        </button>
      </div>
    </div>
  );
}
