"use client";

import Link from "next/link";
import { dataWarning } from "./shared";

const PROVISIONAL = new Set(["CURRENT_DAY_PROVISIONAL", "PROVISIONAL_META_DATA"]);
const KNOWN = new Set([
  "META_DATA_NOT_SYNCED",
  "META_DATA_PARTIAL",
  "UNASSIGNED_SPEND",
  "CHANNEL_FAMILY_FROM_META",
  "STORE_CHANNELS_NOT_CONFIGURED",
  "NON_PEN_SPEND_EXCLUDED",
  ...PROVISIONAL,
]);

export function AdvertisingDataStatus({
  warnings,
  spendAvailable,
  settingsHref = "/publicidad/configuracion?section=accounts",
}: {
  warnings: string[];
  spendAvailable?: boolean;
  settingsHref?: string;
}) {
  const codes = new Set(warnings);
  if (spendAvailable === false && !codes.has("META_DATA_NOT_SYNCED"))
    codes.add("META_DATA_PARTIAL");
  if (codes.size === 0) return null;

  const metaPending = codes.has("META_DATA_NOT_SYNCED") || codes.has("META_DATA_PARTIAL");
  const assignmentsPending =
    codes.has("UNASSIGNED_SPEND") || codes.has("STORE_CHANNELS_NOT_CONFIGURED");
  const provisional = [...codes].some((code) => PROVISIONAL.has(code));
  const unknown = [...codes].some((code) => !KNOWN.has(code));
  const explanations = new Set(
    [...codes].filter((code) => !PROVISIONAL.has(code)).map(dataWarning),
  );
  if (provisional) explanations.add(dataWarning("PROVISIONAL_META_DATA"));

  return (
    <section
      role="status"
      aria-label="Estado de datos"
      className="space-y-3 rounded-lg border bg-card p-4 text-sm"
    >
      <h3 className="font-semibold">Estado de datos</h3>
      {metaPending && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Falta actualizar datos de Meta
            </p>
            <Link href={settingsHref} className="text-primary underline underline-offset-2">
              Ver cuentas de Meta
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Los valores sin confirmar se mantienen con —.
          </p>
        </div>
      )}
      {assignmentsPending ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p>Hay anuncios pendientes de vincular a tiendas o canales.</p>
          <Link href={settingsHref} className="text-primary underline underline-offset-2">
            Revisar tiendas y canales
          </Link>
        </div>
      ) : codes.has("CHANNEL_FAMILY_FROM_META") ? (
        <p className="text-muted-foreground">
          El canal de algunos anuncios se identifica desde Meta.
        </p>
      ) : null}
      {codes.has("NON_PEN_SPEND_EXCLUDED") && (
        <p>Los totales en soles no suman otras monedas. Consulta sus importes por cuenta.</p>
      )}
      {unknown && <p>Hay información pendiente de confirmar.</p>}
      {provisional && (
        <p className="text-xs text-muted-foreground">
          Los resultados recientes todavía pueden cambiar.
        </p>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="w-fit cursor-pointer font-medium text-foreground">Ver detalles</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {[...explanations].map((explanation) => (
            <li key={explanation}>{explanation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
