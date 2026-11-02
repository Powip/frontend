"use client";
import { useQuery } from "@tanstack/react-query";
import { getOrderCourierPaymentEvidence } from "@/services/courierPaymentEvidenceService";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function CourierEvidenceSelector({
  companyId,
  orderId,
  linkedIds,
  selectedId,
  disabled,
  onSelect,
}: {
  companyId: string;
  orderId: string;
  linkedIds: string[];
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const { auth } = useAuth();
  const query = useQuery({
    queryKey: ["courier-payment-evidence", companyId, auth?.user?.id, orderId],
    queryFn: ({ signal }) => getOrderCourierPaymentEvidence(orderId, signal),
    retry: false,
  });
  return (
    <section className="space-y-2 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Reportes de courier por verificar</h3>
      <p className="text-xs text-muted-foreground">
        El importe y las fotos reportados son evidencia pendiente. Verifica el cobro antes de
        confirmarlo; el reporte no aprueba pagos.
      </p>
      {query.isPending ? (
        <p role="status" className="text-sm">
          Consultando reportes…
        </p>
      ) : query.isError || !query.data ? (
        <p role="alert" className="text-sm">
          No se pudieron consultar los reportes.{" "}
          <Button type="button" variant="link" onClick={() => void query.refetch()}>
            Reintentar reportes
          </Button>
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="provider-evidence"
              value=""
              checked={!selectedId}
              disabled={disabled}
              onChange={() => onSelect("")}
            />
            Confirmar con otra evidencia verificada
          </label>
          {query.data.evidence.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay reportes de courier guardados para este pedido.
            </p>
          )}
          {query.data.evidence.map((entry) => {
            const linked = linkedIds.includes(entry.id);
            return (
              <div key={entry.id} className="space-y-1 rounded border p-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="provider-evidence"
                    checked={selectedId === entry.id}
                    disabled={disabled || linked}
                    onChange={() => onSelect(entry.id)}
                  />
                  {entry.provider} · Importe reportado: {entry.reportedAmount ?? "No informado"} ·{" "}
                  {linked ? "Vinculado a un cobro confirmado" : "Por verificar"}
                </label>
                <p className="text-xs text-muted-foreground">
                  {entry.providerStatus} · {new Date(entry.occurredAt).toLocaleString("es-PE")}
                </p>
                <div className="flex flex-wrap gap-3">
                  {entry.photos
                    .filter((url) => {
                      try {
                        return new URL(url).protocol === "https:";
                      } catch {
                        return false;
                      }
                    })
                    .map((url, index) => (
                      <a
                        key={`${index}:${url}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-violet-700 underline"
                      >
                        Abrir evidencia {index + 1}
                      </a>
                    ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
