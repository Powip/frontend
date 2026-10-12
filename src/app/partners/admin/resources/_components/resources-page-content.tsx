"use client";

import { CancelledError } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAdminResources } from "@/features/partners/hooks/use-admin-resources";
import { getHttpStatus } from "@/features/partners/mappers/to-partner-identity-from-error";
import { AdminReadError } from "../../_components/admin-read-error";
import { AdminWriteRecovery } from "../../_components/admin-write-recovery";
import { ResourceEditor } from "./resource-editor";

export function ResourcesPageContent() {
  const { session, query, mutation, mutationForSession, write } = useAdminResources();
  const [selection, setSelection] = useState<{ epoch: number; id: string } | null>(null);
  if (!session.canAccess)
    return (
      <p role="alert" className="p-6">
        Necesitás el permiso PARTNERS_MANAGE_RESOURCES para gestionar recursos.
      </p>
    );
  if (session.denied)
    return (
      <div className="p-6">
        <AdminReadError error={session.denied} message="No tenés acceso actual a los recursos." />
      </div>
    );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const selected =
    selection?.epoch === session.epoch
      ? items.find((resource) => resource.id === selection.id)
      : undefined;
  const currentError =
    mutationForSession && mutation.isError && !(mutation.error instanceof CancelledError)
      ? mutation.error
      : null;
  const status = getHttpStatus(currentError);
  const unknownResult = Boolean(currentError) && (status === null || status >= 500);
  const originalProposal =
    mutationForSession && (mutation.isPending || unknownResult)
      ? mutation.variables?.input
      : undefined;
  const operationLabels = {
    create: "Crear recurso DRAFT",
    revise: "Guardar revisión DRAFT",
    publish: "Publicar recurso",
    unpublish: "Retirar publicación",
    archive: "Archivar recurso",
  };
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">Recursos del programa</h2>
      <Link href="/partners/admin/reglas" className="text-sm underline">
        Ver políticas DRAFT
      </Link>
      <p role="status" className="rounded-lg border p-4 text-sm">
        Solo se gestionan metadatos y enlaces; no se suben archivos. Un recurso DRAFT no aparece en
        el kit. Publicar requiere un enlace HTTPS con host autorizado y hace visible el recurso a
        Partners ACTIVE del país correspondiente.
      </p>
      {originalProposal ? (
        <AdminWriteRecovery
          operationLabel={operationLabels[originalProposal.operation]}
          reason={originalProposal.command.reason}
          isPending={mutation.isPending}
          disabled={!session.enabled}
          onRetry={() => write(originalProposal)}
        />
      ) : null}
      {query.isError ? (
        <AdminReadError
          error={query.error}
          message="No pudimos cargar los recursos."
          onRetry={() => query.refetch()}
        />
      ) : query.isPending ? (
        <p role="status">Cargando recursos…</p>
      ) : (
        <>
          {items.length === 0 ? (
            <p>No hay recursos guardados.</p>
          ) : (
            <div className="space-y-3">
              {items.map((resource) => (
                <article key={resource.id} className="rounded-lg border p-4 text-sm">
                  <h3 className="font-semibold">
                    {resource.title} · {resource.state}
                  </h3>
                  <p>
                    {resource.country} · {resource.kind} · {resource.category} · Orden{" "}
                    {resource.sortOrder} · Versión {resource.version}
                  </p>
                  <p>{resource.description ?? "Sin descripción"}</p>
                  {resource.publicUrl ? (
                    <a
                      href={resource.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Abrir enlace de {resource.title}
                    </a>
                  ) : (
                    <p>Enlace no disponible.</p>
                  )}
                  <p>Actualizado: {resource.updatedAt}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(originalProposal)}
                    onClick={() => setSelection({ epoch: session.epoch, id: resource.id })}
                  >
                    Gestionar {resource.title}
                  </Button>
                </article>
              ))}
            </div>
          )}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              Cargar más recursos
            </Button>
          )}
          {query.isSuccess && !originalProposal && (
            <ResourceEditor
              key={`new:${session.userId}:${session.epoch}`}
              isPending={mutationForSession && mutation.isPending}
              onWrite={write}
            />
          )}
          {selected && !originalProposal && selected.version < Number.MAX_SAFE_INTEGER && (
            <ResourceEditor
              key={`${session.epoch}:${selected.id}:${selected.version}`}
              resource={selected}
              isPending={mutationForSession && mutation.isPending}
              onWrite={write}
            />
          )}
          {selected && !originalProposal && selected.version >= Number.MAX_SAFE_INTEGER ? (
            <p role="status" className="text-sm text-muted-foreground">
              Este recurso alcanzó el límite de versión soportado. No admite más revisiones ni
              cambios de estado; recargar no restablece ese límite.
            </p>
          ) : null}
          {mutationForSession && mutation.isSuccess && !originalProposal && (
            <p role="status">
              Operación confirmada para {mutation.data.id}. La lista muestra el estado actual del
              recurso.
            </p>
          )}
          {mutationForSession &&
            mutation.isError &&
            !originalProposal &&
            !(mutation.error instanceof CancelledError) && (
              <AdminReadError
                error={mutation.error}
                message="No pudimos confirmar la operación. Un conflicto requiere revisar la versión actual; reintentá el mismo comando solo si su resultado es desconocido."
              />
            )}
        </>
      )}
    </div>
  );
}
