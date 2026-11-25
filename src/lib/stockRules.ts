import type {
  InventoryRules,
  ReservationRule,
  ReservationRuleInput,
  StockControlMode,
} from "@/services/warehousesService";

// FEAT-24 H2-F — reglas de reserva por región y reglas de inventario
// (Configuración › Tiendas y almacenes). Lógica pura: la pantalla solo dibuja.

/** Máximo de reglas que acepta la fachada (`ArrayMaxSize(200)`). */
export const RESERVATION_RULES_MAX = 200;
/**
 * Paso entre prioridades al guardar: 10, 20, 30… La fachada acepta 0..10.000
 * (ms-logistics hasta 1.000.000), así que 200 reglas × 10 = 2.000 entra holgado.
 */
export const PRIORITY_STEP = 10;

/** Una regla en edición. `key` es local (las nuevas no tienen id). Vacío = «cualquiera». */
export interface RuleDraft {
  key: string;
  department: string;
  province: string;
  storeId: string;
  inventoryId: string;
  active: boolean;
}

let draftSeq = 0;
/** Clave local estable para las filas de la lista (React `key`). */
export function newRuleKey(): string {
  draftSeq += 1;
  return `nueva-${draftSeq}`;
}

export function emptyRule(defaultInventoryId = ""): RuleDraft {
  return { key: newRuleKey(), department: "", province: "", storeId: "", inventoryId: defaultInventoryId, active: true };
}

/** Las reglas del servidor, en el orden en que se evalúan (prioridad ascendente). */
export function rulesToDrafts(rules: ReservationRule[]): RuleDraft[] {
  return [...rules]
    .sort((a, b) => a.priority - b.priority)
    .map((rule) => ({
      key: rule.id,
      department: rule.department ?? "",
      province: rule.province ?? "",
      storeId: rule.storeId ?? "",
      inventoryId: rule.inventoryId,
      active: rule.active !== false,
    }));
}

const orNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * Cuerpo del PUT: la lista completa, con la prioridad que da el orden en pantalla
 * (la primera fila se evalúa primero). Vacío viaja como `null` = cualquiera.
 */
export function draftsToInput(drafts: RuleDraft[]): ReservationRuleInput[] {
  return drafts.map((draft, index) => {
    const department = orNull(draft.department);
    return {
      priority: (index + 1) * PRIORITY_STEP,
      department,
      // Sin departamento, la provincia no se puede elegir en pantalla: no se manda sola.
      province: department ? orNull(draft.province) : null,
      storeId: orNull(draft.storeId),
      inventoryId: draft.inventoryId,
      active: draft.active,
    };
  });
}

/** Mueve la regla `index` una posición (`delta` −1 sube, +1 baja). Fuera de rango, la lista queda igual. */
export function moveRule<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** ¿La lista en pantalla es distinta de la guardada? (orden incluido). */
export function rulesChanged(drafts: RuleDraft[], saved: ReservationRule[]): boolean {
  return JSON.stringify(draftsToInput(drafts)) !== JSON.stringify(draftsToInput(rulesToDrafts(saved)));
}

export interface RuleProblem {
  key: string;
  message: string;
}

/**
 * Lo que la pantalla puede revisar antes de guardar: cada regla necesita un
 * almacén activo de la empresa y no puede haber más de 200. El resto (tienda de
 * otra empresa, prioridad repetida) lo valida el servidor y se muestra su mensaje.
 */
export function validateRules(drafts: RuleDraft[], activeWarehouseIds: ReadonlySet<string>): RuleProblem[] {
  const problems: RuleProblem[] = [];
  if (drafts.length > RESERVATION_RULES_MAX) {
    problems.push({ key: "", message: `Puedes tener como máximo ${RESERVATION_RULES_MAX} reglas.` });
  }
  for (const draft of drafts) {
    if (!draft.inventoryId) problems.push({ key: draft.key, message: "Elige el almacén de la regla." });
    else if (!activeWarehouseIds.has(draft.inventoryId))
      problems.push({ key: draft.key, message: "El almacén no está activo: elige otro." });
  }
  return problems;
}

/**
 * Una regla que nunca se usa porque otra activa más arriba tiene las mismas
 * condiciones (o más generales). Es un aviso, no impide guardar.
 */
export function shadowedRuleKeys(drafts: RuleDraft[]): Set<string> {
  const shadowed = new Set<string>();
  const norm = (value: string) => value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const covers = (wide: string, narrow: string) => norm(wide) === "" || norm(wide) === norm(narrow);
  drafts.forEach((draft, index) => {
    if (!draft.active) return;
    const coveredBy = drafts.slice(0, index).some(
      (before) =>
        before.active &&
        covers(before.department, draft.department) &&
        // Sin departamento, la provincia de arriba no cuenta (no se manda).
        covers(before.department ? before.province : "", draft.department ? draft.province : "") &&
        (before.storeId === "" || before.storeId === draft.storeId),
    );
    if (coveredBy) shadowed.add(draft.key);
  });
  return shadowed;
}

/**
 * El servidor nombra un almacén o una tienda por su id («El almacén <uuid> no
 * está activo…»): se reemplaza por el nombre cuando se conoce.
 */
export function withNames(message: string, names: ReadonlyMap<string, string>): string {
  return message.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (id) => {
    const name = names.get(id.toLowerCase()) ?? names.get(id);
    return name ? `«${name}»` : id;
  });
}

// ---------- Reglas de inventario ----------

export const RELEASE_AFTER_DAYS_MIN = 1;
export const RELEASE_AFTER_DAYS_MAX = 365;

/**
 * FEAT-24 C-D4 — cuándo se liberan las reservas sin despachar: el valor por defecto de Powip (`null` en el
 * servidor), nunca (`0`) o una cantidad de días (1..365).
 */
export type ReleaseMode = "default" | "never" | "days";

export interface ReleaseForm {
  releaseMode: ReleaseMode;
  /** Los días como se tipean; solo cuenta con `releaseMode = "days"`. */
  releaseDays: string;
}

/** Del valor guardado al formulario: `null` = por defecto, `0` = nunca, N = N días. */
export function releaseFormFrom(days: number | null | undefined): ReleaseForm {
  if (days === null || days === undefined) return { releaseMode: "default", releaseDays: "" };
  if (days === 0) return { releaseMode: "never", releaseDays: "" };
  return { releaseMode: "days", releaseDays: String(days) };
}

/** Lee el campo de días: un entero de 1 a 365; si no, devuelve el error. */
export function parseReleaseDays(text: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: `Escribe cuántos días (de ${RELEASE_AFTER_DAYS_MIN} a ${RELEASE_AFTER_DAYS_MAX}).` };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: "Escribe un número entero de días." };
  const value = Number(trimmed);
  if (value < RELEASE_AFTER_DAYS_MIN || value > RELEASE_AFTER_DAYS_MAX)
    return { ok: false, error: `Los días van de ${RELEASE_AFTER_DAYS_MIN} a ${RELEASE_AFTER_DAYS_MAX}.` };
  return { ok: true, value };
}

/** Del formulario al `releaseAfterDays` del PUT: por defecto → `null`, nunca → `0`, días → 1..365. */
export function releaseAfterDaysFrom(form: ReleaseForm): { ok: true; value: number | null } | { ok: false; error: string } {
  if (form.releaseMode === "default") return { ok: true, value: null };
  if (form.releaseMode === "never") return { ok: true, value: 0 };
  return parseReleaseDays(form.releaseDays);
}

/** Lo que vale hoy «por defecto»: «30 días», «1 día» o «nunca» (`null`). */
export function defaultReleaseText(days: number | null | undefined): string {
  if (days === null || days === undefined || days <= 0) return "nunca";
  return days === 1 ? "1 día" : `${days} días`;
}

export function inventoryRulesChanged(
  form: ReleaseForm & { pickingRequired: boolean; stockControl: StockControlMode },
  saved: Pick<InventoryRules, "releaseAfterDays" | "pickingRequired" | "stockControl">,
): boolean {
  const parsed = releaseAfterDaysFrom(form);
  if (!parsed.ok) return true;
  return (
    parsed.value !== saved.releaseAfterDays ||
    form.pickingRequired !== saved.pickingRequired ||
    form.stockControl !== (saved.stockControl ?? "flexible")
  );
}

/** FEAT-24 C-D3: textos del control de stock (una línea de ayuda por modo). */
export const STOCK_CONTROL_LABEL: Record<StockControlMode, string> = {
  flexible: "Flexible",
  estricto: "Estricto",
};

export const STOCK_CONTROL_HELP: Record<StockControlMode, string> = {
  flexible: "Permite registrar salidas que dejan el stock en negativo, con confirmación. Las reservas no frenan traslados.",
  estricto: "No permite salidas por debajo de 0 ni trasladar más que el disponible.",
};
