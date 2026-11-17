"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Info, Pencil, Plus } from "lucide-react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { PAYMENT_TERMS_LABEL, purchaseAccess } from "@/lib/purchaseOrders";
import { listPurchaseSuppliers, type PurchaseSupplier } from "@/services/purchasesService";
import { Money, PurchasesNav } from "./PurchaseBits";
import SupplierFormDialog from "./SupplierFormDialog";

// FEAT-24 H3-E — Compras › Proveedores (mockup vProv): RUC, razón social,
// contacto, condición de pago, lo comprado en 12 meses y lo que se les debe
// («••••» si el rol no ve costos). Con compras no se borran: se desactivan.

export default function SuppliersView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const access = purchaseAccess(auth?.user);
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<PurchaseSupplier | "new" | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ["purchase-suppliers", companyId, includeInactive ? "all" : "active"],
    queryFn: ({ signal }) => listPurchaseSuppliers(includeInactive, signal),
    enabled: !!companyId,
    retry: false,
  });
  const suppliers = suppliersQuery.data ?? [];

  return (
    <div className="w-full px-4 pb-6 md:px-6">
      <HeaderConfig title="Compras" description="Proveedores a los que les compras" />
      <div className="mb-4">
        <PurchasesNav />
      </div>

      <div className="mb-4 flex gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="text-foreground">Proveedor</strong> con RUC, razón social y dirección fiscal (registro de compras de SUNAT) y
          condición de pago. Con compras, se desactiva; no se borra.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Proveedores
          </CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="suppliers-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
              <Label htmlFor="suppliers-inactive" className="font-normal">
                Mostrar inactivos
              </Label>
            </div>
            {access.canWrite ? (
              <Button type="button" onClick={() => setEditing("new")}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo proveedor
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {suppliersQuery.error ? (
            <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {warehouseErrorMessage(suppliersQuery.error, "No se pudieron cargar los proveedores.")}
              <Button type="button" size="sm" variant="outline" onClick={() => void suppliersQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Proveedor</th>
                  <th className="p-2 text-left">RUC</th>
                  <th className="p-2 text-left">Contacto</th>
                  <th className="p-2 text-left">Condición</th>
                  <th className="p-2 text-right">Compras</th>
                  <th className="p-2 text-right">Comprado (12 meses)</th>
                  <th className="p-2 text-right">Por pagar</th>
                  <th className="p-2 text-left">Estado</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {suppliersQuery.isLoading ? (
                  [...Array(3)].map((_, index) => (
                    <tr key={index} className="border-t">
                      <td colSpan={9} className="p-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Todavía no hay proveedores.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-t">
                      <td className="p-2">
                        <div className="font-semibold">{supplier.name}</div>
                        {supplier.businessName && supplier.businessName !== supplier.name ? (
                          <div className="text-xs text-muted-foreground">{supplier.businessName}</div>
                        ) : null}
                      </td>
                      <td className="p-2 font-mono">{supplier.ruc ?? "—"}</td>
                      <td className="p-2">
                        {supplier.contactPerson ?? "—"}
                        {supplier.phone || supplier.email ? (
                          <div className="text-xs text-muted-foreground">{[supplier.phone, supplier.email].filter(Boolean).join(" · ")}</div>
                        ) : null}
                      </td>
                      <td className="p-2">{PAYMENT_TERMS_LABEL[supplier.paymentTerms] ?? supplier.paymentTerms}</td>
                      <td className="p-2 text-right tabular-nums">{supplier.purchaseCount}</td>
                      <td className="p-2 text-right" data-testid={`purchased-${supplier.id}`}>
                        <Money value={supplier.purchasedLast12Months} />
                      </td>
                      <td className="p-2 text-right" data-testid={`payable-${supplier.id}`}>
                        <Money value={supplier.payable} className={supplier.payable ? "text-destructive" : undefined} />
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            supplier.active
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          }
                        >
                          {supplier.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {access.canWrite ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            aria-label={`Editar ${supplier.name}`}
                            onClick={() => setEditing(supplier)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing ? (
        <SupplierFormDialog
          supplier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["purchase-suppliers", companyId] });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
