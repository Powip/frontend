import type { AdvertisingHistoryImportState } from "@/services/advertisingService";
import { advertisingPeriodFromParams } from "./advertising-period";

export function isAdvertisingHistoryImport(value: unknown): value is AdvertisingHistoryImportState {
  if (!value || typeof value !== "object") return false;
  const job = value as AdvertisingHistoryImportState;
  const date = (value: unknown) =>
    value === null ||
    (typeof value === "string" &&
      advertisingPeriodFromParams(new URLSearchParams({ from: value, to: value })) !== null);
  return (
    typeof job.id === "string" &&
    job.id.length > 0 &&
    ["queued", "running", "succeeded", "failed", "paused"].includes(job.status) &&
    date(job.availableFrom) &&
    date(job.availableTo) &&
    (!job.availableFrom || !job.availableTo || job.availableFrom <= job.availableTo) &&
    Number.isSafeInteger(job.completedWindows) &&
    job.completedWindows >= 0 &&
    (job.totalWindows === null ||
      (Number.isSafeInteger(job.totalWindows) && job.totalWindows >= job.completedWindows)) &&
    (job.errorCode === null ||
      (typeof job.errorCode === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(job.errorCode)))
  );
}

export function advertisingHistoryNotice(imports: AdvertisingHistoryImportState[]): string {
  if (imports.some((job) => job.status === "queued" || job.status === "running"))
    return "Importando historial…";
  if (imports.some((job) => job.status === "failed"))
    return "Hay cuentas con la importación incompleta. Pulsa Actualizar gasto para reintentar.";
  if (imports.some((job) => job.status === "paused")) return "Hay importaciones pausadas.";
  return imports.length ? "Historial disponible importado." : "Historial pendiente de importar.";
}
