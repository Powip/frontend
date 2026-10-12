"use client";

import { commissionEvaluationReasonMessage } from "@/features/partners/mappers/commission-evaluation-reasons";
import type {
  CommissionCalculationItem,
  CommissionEvaluation,
} from "@/features/partners/models/commission-read";

const kindLabel = { FIRST: "Primer pago", RECURRING: "Recurrente", ANNUAL: "Anual" };
const stateLabel = {
  BLOCKED: "Bloqueado por evidencia",
  GENERATED: "Cálculo registrado",
  CONFLICT: "Conflicto de evidencia",
};

export function CommissionItemsEvidenceTable({ items }: { items: CommissionCalculationItem[] }) {
  if (items.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Sin cálculos registrados. Esto no confirma elegibilidad financiera ni un saldo de cero.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm" aria-label="Cálculos de comisión registrados">
        <thead>
          <tr>
            {[
              "Empresa y plan",
              "Tipo",
              "Bases exactas (PEN)",
              "Tasas registradas (fracciones)",
              "Bruto (PEN)",
              "Financiado por Partner (PEN)",
              "Neto calculado (PEN)",
              "Aprobación y evidencia",
            ].map((label) => (
              <th key={label} scope="col" className="p-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t align-top">
              <td className="p-3">
                <p>{item.businessName ?? "Nombre de empresa no disponible"}</p>
                <p className="text-xs text-muted-foreground">
                  Plan: {item.planName ?? "No disponible"}
                </p>
                <code className="text-xs">{item.companyId}</code>
              </td>
              <td className="p-3">{kindLabel[item.kind]}</td>
              <td className="p-3 font-mono">
                <p>Inicial: {item.initialBase ?? "No registrada"}</p>
                <p>Recurrente: {item.recurringBase ?? "No registrada"}</p>
              </td>
              <td className="p-3 font-mono">
                <p>Inicial: {item.firstRate}</p>
                <p>Recurrente: {item.recurringRate}</p>
                <p>Residual: {item.residualRate}</p>
              </td>
              <td className="p-3 font-mono">{item.grossAmount}</td>
              <td className="p-3 font-mono">{item.partnerFundedAmount}</td>
              <td className="p-3 font-mono">{item.netAmount}</td>
              <td className="space-y-2 p-3">
                <code className="text-xs">{item.approvalId}</code>
                <time className="block text-xs" dateTime={item.createdAt}>
                  {item.createdAt}
                </time>
                <details>
                  <summary className="cursor-pointer text-xs">
                    Ver identificadores de evidencia
                  </summary>
                  <dl className="space-y-1 pt-2 text-xs">
                    {[
                      ["Registro", item.id],
                      ["Observación", item.observationId],
                      ["Pago observado", item.paymentId],
                      ["Suscripción", item.subscriptionId],
                      ["Atribución", item.attributionId],
                      ["Partner", item.partnerId],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd className="font-mono">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommissionEvaluationsTable({
  evaluations,
}: {
  evaluations: CommissionEvaluation[];
}) {
  if (evaluations.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No hay evaluaciones registradas para tus referidos. Esto no confirma que estén listos para
        generar comisiones.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm" aria-label="Evaluaciones de comisión">
        <thead>
          <tr>
            {[
              "Observación y atribución",
              "Estado registrado",
              "Evidencia pendiente o conflicto",
              "Registro calculado",
              "Verificaciones UTC",
            ].map((label) => (
              <th key={label} scope="col" className="p-3">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {evaluations.map((evaluation) => (
            <tr key={evaluation.observationId} className="border-t align-top">
              <td className="space-y-1 p-3 text-xs">
                <p>
                  Observación: <code>{evaluation.observationId}</code>
                </p>
                <p>
                  Empresa: <code>{evaluation.companyId ?? "No disponible"}</code>
                </p>
                <p>
                  Atribución: <code>{evaluation.attributionId ?? "No disponible"}</code>
                </p>
              </td>
              <td className="p-3">{stateLabel[evaluation.state]}</td>
              <td className="p-3">
                {evaluation.reasons.length ? (
                  <ul className="space-y-1">
                    {Array.from(new Set(evaluation.reasons)).map((reason) => (
                      <li key={reason}>{commissionEvaluationReasonMessage(reason)}</li>
                    ))}
                  </ul>
                ) : evaluation.state === "GENERATED" ? (
                  "Sin motivos de bloqueo registrados; no confirma liquidación ni pago."
                ) : (
                  "Motivo no registrado; falta revisar el contexto financiero."
                )}
              </td>
              <td className="p-3 text-xs">
                <code>{evaluation.itemId ?? "Sin registro calculado"}</code>
              </td>
              <td className="space-y-1 p-3 text-xs">
                <p>
                  Primera:{" "}
                  <time dateTime={evaluation.firstCheckedAt}>{evaluation.firstCheckedAt}</time>
                </p>
                <p>
                  Última: <time dateTime={evaluation.checkedAt}>{evaluation.checkedAt}</time>
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
