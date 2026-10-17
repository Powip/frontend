"use client";
import axios from "axios";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdsV22 } from "./context";
import { money, decimal, pct } from "./model";

export function adsError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data?.message === "string") return data.message;
    if (error.response?.status === 403) return "No tienes permiso para ver estos datos.";
    if (error.response?.status === 503)
      return "El servicio aún no está configurado. Revisa la conexión en Configuración.";
  }
  return error instanceof Error
    ? error.message
    : "No pudimos consultar los datos. Vuelve a intentar.";
}
export function Failure({ error, retry }: { error: unknown; retry?: () => unknown }) {
  const data = axios.isAxiosError(error) ? error.response?.data : undefined;
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const reason = typeof data?.reason === "string" ? data.reason : data?.errorCode;
  const reconnect =
    data?.reconnectRequired === true ||
    reason === "META_TOKEN_EXPIRED" ||
    reason === "META_PERMISSION_REQUIRED";
  const transientRead =
    status === 503 &&
    ["META_REPORT_PENDING", "META_REPORT_FAILED", "META_TIMEOUT", "META_UNAVAILABLE"].includes(
      reason,
    );
  const providedDelay = Number(data?.retryAfterSeconds);
  const cooldown =
    status === 429 || transientRead
      ? Number.isFinite(providedDelay) && providedDelay > 0
        ? Math.min(86400, Math.ceil(providedDelay))
        : 300
      : 0;
  const [remaining, setRemaining] = useState(cooldown);
  const retryRef = useRef(retry);
  retryRef.current = retry;
  const canRetry = Boolean(retry);
  useEffect(() => {
    setRemaining(cooldown);
    if (!cooldown) return;
    const until = Date.now() + cooldown * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        // Only read failures receive retry callbacks; mutations require a new confirmation.
        if (transientRead && canRetry) void retryRef.current?.();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [error, cooldown, transientRead, canRetry]);
  const countdown = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p>{adsError(error)}</p>
      {remaining > 0 && (
        <p className="text-muted-foreground" role="status">
          {transientRead && retry ? "Volveremos a consultar" : "Podrás volver a intentar"} en{" "}
          {countdown}.
        </p>
      )}
      {reconnect && (
        <a className="inline-block underline" href="/publicidad/configuracion?section=accounts">
          Revisar conexión y permisos de Meta
        </a>
      )}
      {retry && (
        <Button size="sm" variant="outline" disabled={remaining > 0} onClick={() => void retry()}>
          Volver a intentar
        </Button>
      )}
    </div>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  variation,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  variation?: number | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {variation != null && (
          <p className="text-xs text-muted-foreground">
            {variation >= 0 ? "▲" : "▼"} {pct(Math.abs(variation))} vs. período anterior
          </p>
        )}
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  );
}
export function Block({
  title,
  tools,
  children,
}: {
  title: string;
  tools?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {tools}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
export function PermissionValue({
  type = "spend",
  value,
  format = "money",
}: {
  type?: "spend" | "profit";
  value: number | null | undefined;
  format?: "money" | "decimal" | "percent";
}) {
  const { settings } = useAdsV22();
  if (!settings?.capabilities[type]) return null;
  return (
    <>{format === "money" ? money(value) : format === "percent" ? pct(value) : decimal(value)}</>
  );
}
export async function exportAdsWorkbook(
  name: string,
  sheets: Array<{ name: string; rows: Record<string, unknown>[] }>,
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POWIP";
  workbook.created = new Date();
  for (const source of sheets) {
    const sheet = workbook.addWorksheet(source.name.slice(0, 31));
    const keys = [...new Set(source.rows.flatMap((row) => Object.keys(row)))];
    sheet.columns = keys.map((key) => ({
      header: key,
      key,
      width: Math.min(42, Math.max(16, key.length + 2)),
    }));
    for (const row of source.rows) {
      const safe = Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === "number" && !Number.isFinite(value)
            ? "Sin margen"
            : typeof value === "string" && /^[=+@-]/.test(value)
              ? `'${value}`
              : value,
        ]),
      );
      sheet.addRow(safe);
    }
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
    if (keys.length)
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: Math.max(1, sheet.rowCount), column: keys.length },
      };
  }
  const data = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name}.xlsx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex min-w-32 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function dataWarning(code: string) {
  return (
    (
      {
        META_DATA_NOT_SYNCED:
          "Conecta tus cuentas o sincroniza Meta para consultar el gasto. Los datos aún no importados se muestran con —.",
        META_DATA_PARTIAL:
          "La importación de Meta está incompleta. Sincroniza las cuentas para comparar el gasto de este período.",
        CURRENT_DAY_PROVISIONAL:
          "Los datos de hoy son provisionales y pueden actualizarse. El gasto importado ya está disponible.",
      } as Record<string, string>
    )[code] ?? code
  );
}
