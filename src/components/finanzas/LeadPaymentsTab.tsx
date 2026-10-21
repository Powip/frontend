"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  getLeadPaymentCapabilities,
  listLeadPayments,
} from "@/services/leadPaymentsService";
import { commercialLeadError } from "@/services/commercialLeadsService";
import { notifyCommercialChange } from "@/utils/commercialOrders";
import type {
  LeadPaymentCapabilities,
  LeadPaymentList,
  LeadPaymentStatus,
} from "@/types/leadPayments";
import LeadPaymentLedger from "@/components/commercial-leads/LeadPaymentLedger";

const EMPTY: LeadPaymentList = { data: [], total: 0, page: 1, limit: 25 };
export default function LeadPaymentsTab({
  onPaymentUpdated,
  requestedLeadId,
}: {
  onPaymentUpdated: () => void;
  requestedLeadId?: string;
}) {
  const { auth, selectedStoreId } = useAuth();
  const companyId = auth?.company?.id;
  const [caps, setCaps] = useState<LeadPaymentCapabilities | null>(null);
  const [result, setResult] = useState(EMPTY),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1),
    [status, setStatus] = useState<LeadPaymentStatus | "">("PENDING"),
    [companyScope, setCompanyScope] = useState(false),
    [leadId, setLeadId] = useState("");
  const actorScope = `${companyId || ""}:${auth?.user?.id || ""}:${auth?.user?.role || ""}:${(auth?.user?.permissions || []).join(",")}:${selectedStoreId || ""}`;
  const scope = `${actorScope}:${companyScope}:${leadId}:${status}:${page}`;
  const [loadedScope, setLoadedScope] = useState("");
  const epoch = useRef(0);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLeadId(requestedLeadId ?? params.get("leadId") ?? "");
    setPage(1);
  }, [requestedLeadId]);
  useEffect(() => {
    setResult(EMPTY);
    setCaps(null);
    setPage(1);
    setCompanyScope(false);
  }, [actorScope]);
  const load = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true);
    setError("");
    try {
      const capabilities = await getLeadPaymentCapabilities();
      if (request !== epoch.current) return;
      setCaps(capabilities);
      if (
        !capabilities.enabled ||
        !capabilities.canReview ||
        (!selectedStoreId && !companyScope)
      ) {
        setResult(EMPTY);
        setLoadedScope(scope);
        return;
      }
      const response = await listLeadPayments({
        storeId: companyScope ? undefined : selectedStoreId || undefined,
        leadId: leadId || undefined,
        status: status || undefined,
        page,
        limit: 25,
      });
      if (request === epoch.current) {
        setResult(response);
        setLoadedScope(scope);
      }
    } catch (error) {
      if (request === epoch.current) {
        setError(commercialLeadError(error));
        setResult(EMPTY);
        setLoadedScope(scope);
      }
    } finally {
      if (request === epoch.current) setLoading(false);
    }
  }, [scope, selectedStoreId, companyScope, leadId, status, page]);
  useEffect(() => {
    if (companyId) void load();
    else {
      setResult(EMPTY);
      setLoading(false);
    }
    return () => {
      epoch.current += 1;
    };
  }, [companyId, load]);
  const changed = () => {
    void load();
    notifyCommercialChange(companyId, leadId || undefined);
    onPaymentUpdated();
  };
  const visible = loadedScope === scope ? result : EMPTY;
  if (!companyId)
    return <p>Selecciona una empresa para consultar pagos de Leads.</p>;
  return (
    <section
      aria-label="Pagos de Leads"
      className="space-y-4 rounded-xl border bg-card p-5"
    >
      <h2 className="font-semibold text-lg">Anticipos y pagos de Leads</h2>
      <p className="text-sm text-muted-foreground">
        Incluye anticipos sin pedido y los pagos originales vinculados a un
        Lead. Cada fila representa un pago; aprobarlo no confirma la compra.
      </p>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          Alcance
          <select
            aria-label="Alcance de pagos de Leads"
            className="block border rounded p-2"
            value={companyScope ? "COMPANY" : "STORE"}
            onChange={(e) => {
              setCompanyScope(e.target.value === "COMPANY");
              setPage(1);
            }}
          >
            <option value="STORE">Tienda seleccionada</option>
            <option value="COMPANY">
              Toda la empresa, incluidos Leads sin tienda
            </option>
          </select>
        </label>
        <label className="text-sm">
          Estado
          <select
            aria-label="Estado de pagos de Leads"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as LeadPaymentStatus | "");
              setPage(1);
            }}
            className="block border rounded p-2"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="PAID">Aprobados</option>
            <option value="LOST">Rechazados</option>
          </select>
        </label>
        {leadId ? (
          <Button
            variant="outline"
            onClick={() => {
              setLeadId("");
              setPage(1);
            }}
          >
            Quitar filtro de Lead
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => void load()}>
          Actualizar pagos
        </Button>
      </div>
      {loading || loadedScope !== scope ? (
        <p role="status">Cargando pagos de Leads…</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {loadedScope === scope && caps && !caps.enabled ? (
        <p>Los anticipos de Leads todavía no están habilitados.</p>
      ) : null}
      {loadedScope === scope && caps?.enabled && !caps.canReview ? (
        <p>No tienes permiso de Finanzas para revisar estos pagos.</p>
      ) : null}
      {!selectedStoreId && !companyScope ? (
        <p>Selecciona una tienda o el alcance de toda la empresa.</p>
      ) : null}
      {loadedScope === scope &&
      !error &&
      caps?.enabled &&
      caps?.canReview &&
      (selectedStoreId || companyScope) ? (
        <>
          <p className="text-sm">
            {visible.total} pagos encontrados · Página {page}
          </p>
          <LeadPaymentLedger
            payments={visible.data}
            canReview={true}
            canUpload={caps.canCapture}
            onChanged={changed}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading || page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={loading || page * 25 >= visible.total}
              onClick={() => setPage((v) => v + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
