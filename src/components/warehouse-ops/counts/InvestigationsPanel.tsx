"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { formatDay } from "@/lib/purchaseOrders";
import { INVESTIGATION_ORIGIN_LABEL, INVESTIGATION_RESOLUTION_LABEL, lineLabel, opsErrorMessage, warehouseOpsAccess } from "@/lib/warehouseOps";
import {
  listInvestigations,
  resolveInvestigation,
  updateInvestigation,
  type Investigation,
  type InvestigationResolution,
} from "@/services/warehouseOpsService";
import { ErrorBox, Money, SELECT_CLASS } from "../OpsBits";

// FEAT-24 H5-C (H5-D6) — pendientes de investigación (mockup tomasHTML,
// «Pendientes de decisión»): diferencias de conteos y traslados que quedaron
// abiertas. Editar responsable y plazo, y resolver (no mueve stock), lo hacen
// el Administrador y Operaciones.

export const INVESTIGATIONS_KEY = "stock-investigations";

const RESOLUTIONS: InvestigationResolution[] = ["encontrado", "perdida", "reclamo", "otro"];

export default function InvestigationsPanel({ companyId, nameOf }: { companyId: string; nameOf: (inventoryId: string) => string }) {
  const { auth } = useAuth();
  const access = warehouseOpsAccess(auth?.user);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Investigation | null>(null);
  const [resolving, setResolving] = useState<Investigation | null>(null);
  const query = useQuery({
    queryKey: [INVESTIGATIONS_KEY, companyId, "abierto"],
    queryFn: ({ signal }) => listInvestigations({ status: "abierto" }, signal),
    enabled: !!companyId,
    retry: false,
  });
  const open = query.data ?? [];
  const refresh = () => void queryClient.invalidateQueries({ queryKey: [INVESTIGATIONS_KEY, companyId] });

  return (
    <section className="rounded-md border" aria-label="Pendientes de investigación">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Pendientes de investigación</h3>
        <span className={`rounded-full px-2 text-xs ${open.length ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>
          {open.length}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">Diferencias que el dueño o el administrador deben cerrar</span>
      </header>
      {query.isError ? (
        <div className="p-3">
          <ErrorBox>{opsErrorMessage(query.error, "No se pudieron cargar los pendientes.")}</ErrorBox>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Producto</th>
              <th className="px-3 py-2 text-left font-medium">Almacén</th>
              <th className="px-3 py-2 text-right font-medium">Dif.</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-left font-medium">Desde</th>
              <th className="px-3 py-2 text-left font-medium">Responsable · plazo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : open.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Nada pendiente.
                </td>
              </tr>
            ) : (
              open.map((item) => (
                <tr key={item.id} className="border-t" data-testid={`investigation-${item.id}`}>
                  <td className="px-3 py-2">
                    <p>{lineLabel(item)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                  </td>
                  <td className="px-3 py-2">{nameOf(item.inventoryId)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${item.quantity < 0 ? "text-destructive" : ""}`}>{item.quantity > 0 ? `+${item.quantity}` : item.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={"value" in item ? item.value : undefined} />
                  </td>
                  <td className="px-3 py-2">
                    {INVESTIGATION_ORIGIN_LABEL[item.origin] ?? item.origin} <span className="font-mono">{item.referenceNumber ?? ""}</span>
                    <p className="text-xs text-muted-foreground">{formatDay(item.createdAt)}</p>
                  </td>
                  <td className="px-3 py-2">
                    {item.responsible || "Sin responsable"}
                    <p className="text-xs text-muted-foreground">{item.dueDate ? `hasta ${formatDay(item.dueDate)}` : "sin plazo"}</p>
                  </td>
                  <td className="px-3 py-2">
                    {access.manage ? (
                      <div className="flex justify-end gap-1 whitespace-nowrap">
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(item)}>
                          Editar
                        </Button>
                        <Button type="button" size="sm" onClick={() => setResolving(item)}>
                          Resolver
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing ? (
        <EditInvestigationDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
      {resolving ? (
        <ResolveInvestigationDialog
          item={resolving}
          onClose={() => setResolving(null)}
          onSaved={() => {
            setResolving(null);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function EditInvestigationDialog({ item, onClose, onSaved }: { item: Investigation; onClose: () => void; onSaved: () => void }) {
  const [responsible, setResponsible] = useState(item.responsible ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const save = useMutation({
    mutationFn: () => updateInvestigation(item.id, { ...(responsible.trim() ? { responsible: responsible.trim() } : {}), ...(dueDate ? { dueDate } : {}) }),
    onSuccess: () => {
      toast.success("Pendiente actualizado");
      onSaved();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Responsable y plazo</DialogTitle>
          <DialogDescription>{lineLabel(item)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="inv-responsible">Responsable</Label>
            <Input id="inv-responsible" maxLength={100} value={responsible} onChange={(event) => setResponsible(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-due">Fecha límite</Label>
            <Input id="inv-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>
        {save.isError ? <ErrorBox>{opsErrorMessage(save.error, "No se pudo guardar.")}</ErrorBox> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResolveInvestigationDialog({ item, onClose, onSaved }: { item: Investigation; onClose: () => void; onSaved: () => void }) {
  const [resolution, setResolution] = useState<InvestigationResolution>("encontrado");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => resolveInvestigation(item.id, { resolution, ...(note.trim() ? { note: note.trim() } : {}) }),
    onSuccess: () => {
      toast.success("Pendiente resuelto");
      onSaved();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolver · {lineLabel(item)}</DialogTitle>
          <DialogDescription>
            {item.quantity > 0 ? `+${item.quantity}` : item.quantity} und · desde {INVESTIGATION_ORIGIN_LABEL[item.origin] ?? item.origin} {item.referenceNumber ?? ""}. Resolver
            no mueve stock: registra qué pasó.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="inv-resolution">Qué pasó</Label>
            <select id="inv-resolution" className={SELECT_CLASS} value={resolution} onChange={(event) => setResolution(event.target.value as InvestigationResolution)}>
              {RESOLUTIONS.map((value) => (
                <option key={value} value={value}>
                  {INVESTIGATION_RESOLUTION_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-note">Nota</Label>
            <Textarea id="inv-note" maxLength={500} placeholder="Qué se encontró o por qué se decide así" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </div>
        {save.isError ? <ErrorBox>{opsErrorMessage(save.error, "No se pudo resolver.")}</ErrorBox> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
