"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ExcelJS from "exceljs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { canEditInventory } from "@/config/permissions.config";

import {
  Download,
  Loader2,
  Search,
  ShoppingCart,
  ShoppingBag,
  History,
  LayoutList,
  GitMerge,
} from "lucide-react";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBusinessScope } from "@/contexts/BusinessScopeContext";
import { useBusinessInventories } from "@/hooks/useBusinessInventories";
import { fetchBusinessInventoryItems, type BusinessInventoryItem } from "@/services/businessInventoryItemsService";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { listWarehouses } from "@/services/warehousesService";

import RegularizeProductModal from "@/components/inventory/RegularizeProductModal";
import InventoryUnitTraceModal from "@/components/inventory/InventoryUnitTraceModal";
import InventoryUnitMovementModal from "@/components/inventory/InventoryUnitMovementModal";
import InventoryUnitsModal from "@/components/inventory/InventoryUnitsModal";
import AdjustStockModal from "@/components/modals/AdjustStockModal";
import { formatVariantLabel } from "@/lib/variantAttributes";
import EditProductImageModal from "@/components/modals/EditProductImageModal";
import ImportExcelModal from "@/components/modals/ImportExcelModal";
import { Pagination } from "@/components/ui/pagination";
import ShopifySyncWizard from "@/app/productos/shopify-sync-wizard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementHistoryTable } from "@/components/inventory/MovementHistoryTable";
import { ReconciliationTab } from "@/components/inventory/ReconciliationTab";
import { StockByProduct, StockByWarehouse, StockKpis, type StockBoardActions } from "@/components/inventory/StockBoard";
import { filterStockVariants, groupByProduct, stockTotals, storesOf, variantPositionsFlat, visibleInventories, STOCK_STATUS_LABEL, type StockMode, type StockStatusFilter } from "@/components/inventory/stockView";

const ITEMS_PER_PAGE = 10;

/** Pestañas del módulo (mockup vistainv.html, grupo «Almacén»). Cada una vive en su propia ruta. */
export type InventarioTab = "stock" | "movimientos" | "unificacion";
export const INVENTARIO_TAB_ROUTES: Record<InventarioTab, string> = {
  stock: "/inventario/stock",
  movimientos: "/inventario/movimientos",
  unificacion: "/inventario/unificacion",
};

export default function InventarioView({ tab = "stock", initialMovementSearch = "" }: { tab?: InventarioTab; initialMovementSearch?: string }) {
  const { auth } = useAuth();
  // Editar inventario (ajustes, mermas, transferencias, importar Excel, compras, reconciliación): solo
  // Administrador y Operaciones. El resto sigue viendo el stock en solo lectura.
  const canEdit = canEditInventory(auth?.user);
  const queryClient = useQueryClient();
  const { scope, storeIds, canFetch } = useBusinessScope();
  const warehouses = useBusinessInventories({ scope, storeIds });
  const storeInventories = warehouses.inventories;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInventoryId, setSelectedInventoryId] = useState("all");
  const [selectedStoreId, setSelectedStoreId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [stockMode, setStockMode] = useState<StockMode>("producto");
  const [isExporting, setIsExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [mode, setMode] = useState<"table" | "shopify">("table");
  const [includeInactive, setIncludeInactive] = useState(false);
  const companyId = auth?.company?.id ?? "";
  const inventoryQuery = useQuery({
    queryKey: ["business-inventory-items", companyId, auth?.user?.id, scope, storeIds, storeInventories.map((inv) => inv.id).sort(), includeInactive],
    queryFn: ({ signal }) => fetchBusinessInventoryItems({ inventories: storeInventories, companyId, accessToken: auth?.accessToken ?? "", signal, includeInactive }),
    enabled: canFetch && warehouses.isSuccess,
    retry: false,
  });
  // Tipo y «Principal» de cada almacén (pantalla de almacenes de la empresa). Es un adorno: si falla, no se muestra.
  const warehouseMetaQuery = useQuery({
    queryKey: ["company-warehouses", companyId],
    queryFn: () => listWarehouses(),
    enabled: Boolean(companyId && auth?.accessToken),
    retry: false,
    staleTime: 60_000,
  });
  const warehouseMeta = useMemo(() => new Map((warehouseMetaQuery.data?.warehouses ?? []).map((w) => [w.id, { type: w.type, isMain: w.is_main }])), [warehouseMetaQuery.data]);
  const stockFilters = useMemo(() => ({ search: searchQuery, storeId: selectedStoreId, inventoryId: selectedInventoryId, status: statusFilter }), [searchQuery, selectedStoreId, selectedInventoryId, statusFilter]);
  // Variantes (con sus posiciones por almacén) agrupadas por producto: la paginación cuenta productos.
  const variantRows = useMemo(() => filterStockVariants(inventoryQuery.data ?? [], stockFilters), [inventoryQuery.data, stockFilters]);
  const productGroups = useMemo(() => groupByProduct(variantRows), [variantRows]);
  const stores = useMemo(() => storesOf(storeInventories), [storeInventories]);
  const warehouseColumns = useMemo(() => visibleInventories(storeInventories, stockFilters), [storeInventories, stockFilters]);
  const warehouseOptions = useMemo(() => visibleInventories(storeInventories, { storeId: selectedStoreId, inventoryId: "all" }), [storeInventories, selectedStoreId]);
  const totalItems = productGroups.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const pagedGroups = productGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const isLoadingInventories = warehouses.isPending;
  const isLoading = warehouses.isPending || (warehouses.isSuccess && inventoryQuery.isPending);
  const loadError = warehouses.error || inventoryQuery.error;
  const refreshItems = async () => { await inventoryQuery.refetch({ throwOnError: true }); };
  const handleStockRefresh = () => {
    void refreshItems().catch(() => {
      toast.warning("Los cambios se guardaron, pero no se pudo actualizar el almacén. Recarga la página.");
    });
  };
  const totals = useMemo(() => stockTotals(variantRows), [variantRows]);

  const router = useRouter();

  const [unitTrace, setUnitTrace] = useState<{ companyId: string; userId: string; code: string } | null>(null);
  const [trackingItem, setTrackingItem] = useState<{ item: BusinessInventoryItem; companyId: string; action: "regularize" | "units" | "transfer" | "write-off" } | null>(null);
  useEffect(() => { setTrackingItem(null); setUnitTrace(null); }, [companyId, auth?.user?.id]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemForSale | null>(
    null,
  );
  const [imageItem, setImageItem] = useState<InventoryItemForSale | null>(null);
  const imageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedInventoryId, selectedStoreId, statusFilter]);
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(totalPages, 1)));
  }, [totalPages]);
  useEffect(() => {
    if (selectedInventoryId !== "all" && warehouses.isSuccess && !warehouseOptions.some((inv) => inv.id === selectedInventoryId)) setSelectedInventoryId("all");
  }, [selectedInventoryId, warehouseOptions, warehouses.isSuccess]);
  useEffect(() => {
    if (selectedStoreId !== "all" && warehouses.isSuccess && !stores.some((store) => store.id === selectedStoreId)) setSelectedStoreId("all");
  }, [selectedStoreId, stores, warehouses.isSuccess]);

  // La unificación es de quienes editan inventario: el resto vuelve al stock.
  useEffect(() => {
    if (auth && tab === "unificacion" && !canEdit) router.replace(INVENTARIO_TAB_ROUTES.stock);
  }, [auth, tab, canEdit, router]);

  if (!auth) return null;
  const stockActions: StockBoardActions = {
    canEdit,
    onImage: (item, trigger) => { imageTriggerRef.current = trigger; setImageItem(item); },
    onTracking: (item, action) => setTrackingItem({ item, companyId, action }),
    onAdjust: (item) => { setSelectedItem(item); setAdjustOpen(true); },
    onEdit: (variantId) => router.push(`/productos?edit=${variantId}`),
    onKardex: (sku) => router.push(`${INVENTARIO_TAB_ROUTES.movimientos}?q=${encodeURIComponent(sku)}`),
  };
  const activeTab: InventarioTab = tab === "unificacion" && !canEdit ? "stock" : tab;

  const handleExportExcel = async () => {
    if (loadError || isLoading) { toast.error("Espera a que el inventario termine de cargar correctamente."); return; }

    setIsExporting(true);

    try {
      const fresh = await fetchBusinessInventoryItems({ inventories: storeInventories, companyId, accessToken: auth.accessToken, includeInactive });
      const items = variantPositionsFlat(filterStockVariants(fresh, stockFilters));

      if (items.length === 0) {
        toast.warning("No hay productos para exportar");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Almacén");

      worksheet.columns = [
        { header: "SKU Empresa", key: "companySku", width: 20 },
        { header: "SKU POWIP", key: "sku", width: 20 },
        { header: "Nombre", key: "name", width: 30 },
        { header: "Variante", key: "variante", width: 30 },
        { header: "Tienda", key: "store", width: 25 },
        { header: "Almacén", key: "inventory", width: 25 },
        { header: "Físico", key: "stock", width: 12 },
        { header: "Reservado", key: "reservado", width: 12 },
        { header: "Disponible", key: "disponible", width: 12 },
        { header: "Precio venta", key: "precio", width: 15, style: { numFmt: '"S/" #,##0.00' } },
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).alignment = { horizontal: "center" };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF02A8E1" },
      };

      items.forEach((prod) => {
        worksheet.addRow({
          companySku: prod.companySku ?? "",
          sku: prod.sku,
          name: prod.productName,
          variante: formatVariantLabel(prod.attributes),
          store: prod.storeName || prod.storeId,
          inventory: prod.inventoryName,
          stock: prod.physicalStock,
          reservado: prod.reservedStock,
          disponible: prod.availableStock,
          precio: prod.priceVta,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Almacen_${scope === "business" ? "Negocio" : "Tienda"}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Exportados ${items.length} producto(s)`);
    } catch (err) {
      console.error("Error al exportar el inventario:", err);

      // Señal principal: el API Gateway (Spring Cloud Gateway, response-timeout
      // 20s) corta la conexión y devuelve un 5xx (típicamente 504) cuando el
      // fetch de "todo" se demora demasiado. ECONNABORTED (timeout del lado
      // cliente de axios) queda como señal secundaria: axiosAuth hoy no
      // configura timeout propio, así que casi nunca se dispara en producción.
      const isTimeout =
        isAxiosError(err) &&
        ((err.response?.status ?? 0) >= 500 || err.code === "ECONNABORTED");

      toast.error(
        isTimeout
          ? "La exportación tardó demasiado. Intente nuevamente o aplique un filtro más específico."
          : "No se pudo exportar el inventario. Intente nuevamente.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col px-6">
      {trackingItem?.companyId === companyId && trackingItem.action === "regularize" ? <RegularizeProductModal key={`${companyId}:${trackingItem.item.productId}`} companyId={companyId} productId={trackingItem.item.productId} productName={trackingItem.item.productName} onClose={() => setTrackingItem(null)} onSaved={handleStockRefresh} /> : null}
      {trackingItem?.companyId === companyId && trackingItem.action === "units" ? <InventoryUnitsModal key={`${companyId}:${trackingItem.item.inventoryItemId}`} companyId={companyId} inventoryItemId={trackingItem.item.inventoryItemId} productName={trackingItem.item.productName} onViewHistory={(code) => setUnitTrace({ companyId, userId: auth.user.id, code })} onClose={() => setTrackingItem(null)} /> : null}
      {trackingItem?.companyId === companyId && (trackingItem.action === "transfer" || trackingItem.action === "write-off") ? <InventoryUnitMovementModal key={`${companyId}:${auth.user?.id}:${trackingItem.item.inventoryItemId}:${trackingItem.action}`} companyId={companyId} source={trackingItem.item} action={trackingItem.action} onClose={() => setTrackingItem(null)} onSaved={() => {
        handleStockRefresh();
        void queryClient.invalidateQueries({ queryKey: ["admin-shrinkage-list", companyId] });
        void queryClient.invalidateQueries({ queryKey: ["admin-shrinkage-summary", companyId] });
        void queryClient.invalidateQueries({ queryKey: ["inventory-movement-history", companyId] });
      }} /> : null}
      {unitTrace?.companyId === companyId && unitTrace.userId === auth.user.id ? <InventoryUnitTraceModal companyId={companyId} initialCode={unitTrace.code} onClose={() => setUnitTrace(null)} /> : null}
      <HeaderConfig
        title="Almacén"
        description="Control de stock por tienda y almacén"
      />

      {mode === "shopify" ? (
        <div className="flex flex-col items-center justify-center py-10">
          <ShopifySyncWizard onBack={() => setMode("table")} />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(next) => router.push(INVENTARIO_TAB_ROUTES[next as InventarioTab])} className="flex-1 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="stock" className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                Stock
              </TabsTrigger>
              <TabsTrigger value="movimientos" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Movimientos
              </TabsTrigger>
              {canEdit && (
                <TabsTrigger
                  value="unificacion"
                  className="flex items-center gap-2"
                >
                  <GitMerge className="h-4 w-4" />
                  Unificación
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setUnitTrace({ companyId, userId: auth.user.id, code: "" })}>Buscar IMEI/serie</Button>
              {canEdit && (
                <Link href="/compras">
                  <Button variant="outline" size="sm">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Compras
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                className="border-teal-100 dark:border-teal-900/30 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                onClick={() => setMode("shopify")}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                Sincronizar Shopify
              </Button>
            </div>
          </div>

          <TabsContent value="stock" className="flex-1 flex flex-col mt-0">
            <Card className="flex-1 flex flex-col">
              <CardContent className="p-6 flex-1 flex flex-col">
                <StockKpis totals={totals} variantCount={variantRows.length} />

                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                  <div className="relative flex-1 lg:min-w-[260px] lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Buscar por SKU, nombre o variante..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {scope === "business" && stores.length > 1 ? (
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                      <SelectTrigger className="lg:w-[200px]" aria-label="Tienda"><SelectValue placeholder="Tienda" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las tiendas</SelectItem>
                        {stores.map((store) => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Tienda: <span className="font-medium text-foreground">{scope === "business" ? "Todo el negocio" : auth.company?.stores?.find((store) => store.id === storeIds[0])?.name || "Tienda seleccionada"}</span>
                    </p>
                  )}

                  {isLoadingInventories ? (
                    <div className="flex h-9 items-center gap-2 rounded-md border bg-muted px-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Cargando almacenes...</span>
                    </div>
                  ) : (
                    <Select value={selectedInventoryId || undefined} onValueChange={setSelectedInventoryId} disabled={storeInventories.length === 0}>
                      <SelectTrigger className="lg:w-[240px]" aria-label="Almacén"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos mis almacenes</SelectItem>
                        {warehouseOptions.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.name} {inv.storeName ? `· ${inv.storeName}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StockStatusFilter)}>
                    <SelectTrigger className="lg:w-[170px]" aria-label="Estado"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="agotado">{STOCK_STATUS_LABEL.agotado}</SelectItem>
                      <SelectItem value="bajo">{STOCK_STATUS_LABEL.bajo}</SelectItem>
                      <SelectItem value="normal">{STOCK_STATUS_LABEL.normal}</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Vista del stock">
                    {(["producto", "almacen"] as const).map((value) => (
                      <Button key={value} type="button" size="sm" variant={stockMode === value ? "default" : "ghost"} aria-pressed={stockMode === value} onClick={() => setStockMode(value)}>
                        {value === "producto" ? "Por producto" : "Por almacén"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {!isLoading && !loadError ? `${totalItems} producto(s) · ${variantRows.length} variante(s)` : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={includeInactive}
                        onChange={(event) => setIncludeInactive(event.target.checked)}
                      />
                      Mostrar inactivas
                    </label>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportOpen(true)}
                      >
                        <Download className="mr-2 h-4 w-4 rotate-180" />
                        Importar Excel
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportExcel}
                      disabled={isExporting || isLoading || Boolean(loadError)}
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Exportando...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Exportar en Excel
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {loadError ? (
                  <div role="alert" className="mb-4 rounded border border-destructive p-4">
                    No se pudo cargar el inventario. {loadError instanceof Error ? loadError.message : "Verifica la sesión."}
                    <Button variant="outline" className="ml-3" onClick={() => { void warehouses.refetch(); if (warehouses.isSuccess) void inventoryQuery.refetch(); }}>Reintentar</Button>
                  </div>
                ) : null}

                {stockMode === "producto" ? (
                  <>
                    <StockByProduct
                      groups={pagedGroups}
                      inventories={warehouseColumns}
                      meta={warehouseMeta}
                      isLoading={isLoading}
                      emptyText={loadError ? "No se pudo consultar el stock" : "No hay productos con estos filtros"}
                      actions={stockActions}
                    />
                    {!isLoading && (
                      <div className="mt-4">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          totalItems={totalItems}
                          itemsPerPage={ITEMS_PER_PAGE}
                          onPageChange={setCurrentPage}
                          itemName="productos"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <StockByWarehouse variants={variantRows} inventories={warehouseColumns} isLoading={isLoading} meta={warehouseMeta} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movimientos" className="flex-1 flex flex-col mt-0">
            <Card className="flex-1 flex flex-col">
              <CardContent className="p-6 overflow-auto">
                <MovementHistoryTable initialSearch={initialMovementSearch} companyId={auth?.company?.id} scope={scope} inventories={storeInventories} scopeReady={warehouses.isSuccess} scopeError={scope === "store" ? warehouses.error : undefined} onRetryScope={() => void warehouses.refetch()} />
              </CardContent>
            </Card>
          </TabsContent>

          {canEdit && (
          <TabsContent
            value="unificacion"
            className="flex-1 flex flex-col mt-0"
          >
            <Card className="flex-1 flex flex-col">
              <CardContent className="p-6 overflow-auto">
                <p className="mb-3 text-sm text-muted-foreground">Unificación del catálogo de todo el negocio.</p>
                <ReconciliationTab companyId={auth?.company?.id} />
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      )}

      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        inventoryId={selectedInventoryId === "all" ? "" : selectedInventoryId}
        onSuccess={handleStockRefresh}
      />

      <AdjustStockModal
        open={adjustOpen}
        item={selectedItem}
        onClose={() => setAdjustOpen(false)}
        onSuccess={handleStockRefresh}
      />

      {imageItem && (
        <EditProductImageModal
          key={imageItem.inventoryItemId}
          item={imageItem}
          onClose={() => setImageItem(null)}
          onCloseAutoFocus={() => {
            if (imageTriggerRef.current?.isConnected) {
              imageTriggerRef.current.focus();
            } else {
              searchInputRef.current?.focus();
            }
          }}
          onSuccess={async (imageUrl) => {
            const queryKey = ["business-inventory-items", companyId, auth.user?.id];
            await queryClient.cancelQueries({ queryKey }, { revert: false, silent: true });
            queryClient.setQueriesData<BusinessInventoryItem[]>(
              { queryKey },
              (items) => items?.map((item) =>
                (imageItem.productId
                  ? item.productId === imageItem.productId
                  : item.variantId === imageItem.variantId)
                  ? { ...item, imageUrl }
                  : item,
              ),
            );
            void refreshItems().catch(() => {
              toast.warning("Imagen guardada, pero no se pudo actualizar el almacén. Recarga la página.");
            });
          }}
        />
      )}
    </div>
  );
}
