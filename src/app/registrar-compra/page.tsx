"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Search,
  ShoppingCart,
  Package,
  AlertTriangle,
  Loader2,
  Save,
  Calendar,
  FileText,
  CreditCard,
  Users,
} from "lucide-react";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}

interface ProductVariant {
  inventoryItemId: string;
  variantId: string;
  productName: string;
  sku: string;
  price: number;
  priceBase: number;
  attributes: Record<string, string>;
  availableStock: number;
  supplierId: string | null;
  supplierName: string | null;
  brandId: string | null;
  brandName: string | null;
  physicalStock: number;
}

interface CartItem {
  id: string;
  inventoryItemId: string;
  variantId: string;
  productName: string;
  sku: string;
  attributes: Record<string, string>;
  quantity: number;
  unitCost: number;
  supplierId: string;
  supplierName: string;
  brandName: string;
  currentStock: number;
}

interface PurchaseData {
  id: string;
  purchaseNumber: string;
  inventoryId: string;
  notes: string | null;
  receiptType?: string;
  paymentMethod?: string;
  purchaseDate?: string;
  items: {
    id: string;
    variantId: string;
    supplierId: string;
    supplierName: string;
    sku: string;
    productName: string;
    quantity: number;
    unitCost: number;
    attributes?: Record<string, string>;
  }[];
}

const RECEIPT_TYPES = [
  { value: "FACTURA", label: "Factura Electrónica" },
  { value: "BOLETA", label: "Boleta de Venta" },
  { value: "NOTA_CREDITO", label: "Nota de Crédito" },
  { value: "GUIA_REMISION", label: "Guía de Remisión" },
];

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia Bancaria" },
  { value: "TARJETA", label: "Tarjeta de Crédito/Débito" },
  { value: "CREDITO", label: "Crédito" },
];

export default function RegistrarCompraPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPurchaseId = searchParams.get("edit");

  const { auth, selectedStoreId, inventories } = useAuth();

  const companyId = auth?.company?.id;

  // Step control
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPurchaseData, setEditPurchaseData] = useState<PurchaseData | null>(
    null,
  );
  const [isLoadingPurchase, setIsLoadingPurchase] = useState(false);

  // Step 1 fields
  const [receiptType, setReceiptType] = useState("FACTURA");
  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [notes, setNotes] = useState("");

  // Inventory selection
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");

  // Products
  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState<ProductVariant[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const [productsMeta, setProductsMeta] = useState<{
    total: number;
    totalPages: number;
  } | null>(null);

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create supplier modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  // Load purchase data if in edit mode
  useEffect(() => {
    if (editPurchaseId) {
      loadPurchaseForEdit(editPurchaseId);
    }
  }, [editPurchaseId]);

  const loadPurchaseForEdit = async (purchaseId: string) => {
    setIsLoadingPurchase(true);
    setIsEditMode(true);
    try {
      const res = await axios.get<PurchaseData>(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase/${purchaseId}`,
      );

      const purchase = res.data;
      setEditPurchaseData(purchase);
      setSelectedInventoryId(purchase.inventoryId);
      setNotes(purchase.notes || "");
      setReceiptType(purchase.receiptType || "FACTURA");
      setPaymentMethod(purchase.paymentMethod || "EFECTIVO");
      setPurchaseDate(
        purchase.purchaseDate
          ? new Date(purchase.purchaseDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      );

      // Get supplier from first item
      if (purchase.items.length > 0) {
        setSelectedSupplierId(purchase.items[0].supplierId);
      }

      // Convert purchase items to cart items and fetch current stock
      const cartItemsPromises = purchase.items.map(async (item) => {
        let currentStock = 0;
        let brandName = "";
        try {
          const stockRes = await axios.get(
            `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/search`,
            {
              params: {
                inventoryId: purchase.inventoryId,
                q: item.sku,
                page: 1,
                limit: 1,
              },
            },
          );
          const variant = stockRes.data.data.find(
            (v: ProductVariant) => v.variantId === item.variantId,
          );
          if (variant) {
            currentStock = variant.physicalStock ?? variant.availableStock;
            brandName = variant.brandName || "";
          }
        } catch (err) {
          console.error(`Error fetching stock for ${item.sku}`, err);
        }

        return {
          id: item.id,
          inventoryItemId: "",
          variantId: item.variantId,
          productName: item.productName,
          sku: item.sku,
          attributes: item.attributes || {},
          quantity: item.quantity,
          unitCost: Number(item.unitCost),
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          brandName: brandName,
          currentStock,
        };
      });

      const cartItems = await Promise.all(cartItemsPromises);
      setCart(cartItems);
      setCurrentStep(2); // Go to step 2 in edit mode
      toast.success(`Compra ${purchase.purchaseNumber} cargada para edición`);
    } catch (error) {
      console.error("Error loading purchase", error);
      toast.error("Error al cargar la compra");
      router.push("/compras");
    } finally {
      setIsLoadingPurchase(false);
    }
  };

  // Set default inventory
  useEffect(() => {
    if (inventories.length > 0 && !selectedInventoryId && !isEditMode) {
      setSelectedInventoryId(inventories[0].id);
    }
  }, [inventories, selectedInventoryId, isEditMode]);

  // Load suppliers
  useEffect(() => {
    if (companyId) {
      fetchSuppliers();
    }
  }, [companyId]);

  const fetchSuppliers = async () => {
    if (!companyId) return;
    setSuppliersLoading(true);
    try {
      const res = await axios.get<Supplier[]>(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/suppliers/company/${companyId}`,
      );
      setSuppliers(res.data.filter((s) => s.isActive));
    } catch (error) {
      console.error("Error fetching suppliers", error);
      toast.error("Error al cargar proveedores");
    } finally {
      setSuppliersLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("El nombre del proveedor es requerido");
      return;
    }

    setIsCreatingSupplier(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/suppliers`,
        { name: newSupplierName.trim(), companyId },
      );

      toast.success("Proveedor creado exitosamente");

      // Reload suppliers
      await fetchSuppliers();

      // Select the new supplier
      setSelectedSupplierId(res.data.id);

      // Close modal and reset
      setSupplierModalOpen(false);
      setNewSupplierName("");
    } catch (error) {
      console.error("Error creating supplier", error);
      toast.error("Error al crear proveedor");
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const searchProducts = async (page = 1) => {
    if (!selectedInventoryId) return;

    setProductsLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/search`,
        {
          params: {
            inventoryId: selectedInventoryId,
            q: productQuery || undefined,
            page,
            limit: 10,
          },
        },
      );

      setProducts(res.data.data);
      setProductsMeta({
        total: res.data.meta.total,
        totalPages: res.data.meta.totalPages,
      });
      setProductsPage(page);
    } catch (error) {
      console.error("Error searching products", error);
      toast.error("Error al buscar productos");
    } finally {
      setProductsLoading(false);
    }
  };

  // Auto-search when entering step 2
  useEffect(() => {
    if (currentStep === 2 && selectedInventoryId) {
      searchProducts(1);
    }
  }, [currentStep]);

  const addToCart = (product: ProductVariant) => {
    const existing = cart.find((item) => item.variantId === product.variantId);
    if (existing) {
      toast.warning("Este producto ya está en el carrito");
      return;
    }

    const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

    const newItem: CartItem = {
      id: crypto.randomUUID(),
      inventoryItemId: product.inventoryItemId,
      variantId: product.variantId,
      productName: product.productName,
      sku: product.sku,
      attributes: product.attributes,
      quantity: 1,
      unitCost: product.priceBase || 0,
      supplierId: product.supplierId || selectedSupplierId,
      supplierName: product.supplierName || selectedSupplier?.name || "",
      brandName: product.brandName || "",
      currentStock: product.physicalStock ?? product.availableStock,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const updateCartItem = (
    cartItemId: string,
    field: "quantity" | "unitCost",
    value: number,
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== cartItemId) return item;
        return { ...item, [field]: value };
      }),
    );
  };

  const handleCreateProduct = () => {
    router.push("/productos");
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  };

  const canProceedToStep2 = () => {
    return (
      selectedSupplierId &&
      selectedInventoryId &&
      receiptType &&
      paymentMethod &&
      purchaseDate
    );
  };

  const canSubmit = () => {
    if (cart.length === 0) return false;
    if (!selectedInventoryId) return false;
    return cart.every((item) => item.quantity > 0 && item.unitCost >= 0);
  };

  const handleSubmit = async () => {
    if (!canSubmit()) {
      toast.error("Completa todos los campos del carrito");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedSupplier = suppliers.find(
        (s) => s.id === selectedSupplierId,
      );

      const payload = {
        companyId,
        storeId: selectedStoreId,
        inventoryId: selectedInventoryId,
        notes: notes || null,
        userEmail: auth?.user?.email || null,
        receiptType,
        paymentMethod,
        purchaseDate,
        supplierId: selectedSupplierId,
        supplierName: getSelectedSupplierName(),
        items: cart.map((item) => ({
          variantId: item.variantId,
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          sku: item.sku,
          productName: item.productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          attributes: item.attributes,
        })),
      };

      if (isEditMode && editPurchaseData) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase/${editPurchaseData.id}`,
          payload,
        );
        toast.success("Compra actualizada correctamente");
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase`,
          payload,
        );
        toast.success("Compra registrada correctamente");
        setCart([]);
        setNotes("");
      }

      router.push("/compras");
    } catch (error) {
      console.error("Error saving purchase", error);
      toast.error(
        isEditMode
          ? "Error al actualizar la compra"
          : "Error al registrar la compra",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    toast.info("Carrito vaciado");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(amount);
  };

  const getSelectedSupplierName = () => {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    return supplier?.name || "";
  };

  if (!auth) return null;

  if (isLoadingPurchase) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando compra...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen w-full bg-background overflow-hidden">
      {/* Main content */}
      <main className="flex-1 p-4 lg:p-6 space-y-4 md:space-y-6 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <Link href="/compras">
            <Button variant="outline" size="sm" className="hidden md:flex">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            <Button variant="outline" size="icon" className="md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {isEditMode
                ? `Editar Compra - ${editPurchaseData?.purchaseNumber}`
                : "Nueva Compra"}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {currentStep === 1
                ? "Paso 1: Configura los datos de la compra"
                : "Paso 2: Agrega productos al carrito"}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 no-scrollbar">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full whitespace-nowrap ${currentStep === 1 ? "bg-primary text-primary-foreground text-xs md:text-sm" : "bg-muted text-muted-foreground text-xs"}`}
          >
            <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="font-medium">1. Datos de Compra</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div
            className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full whitespace-nowrap ${currentStep === 2 ? "bg-primary text-primary-foreground text-xs md:text-sm" : "bg-muted text-muted-foreground text-xs"}`}
          >
            <ShoppingCart className="h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="font-medium">2. Agregar Productos</span>
          </div>
        </div>

        {/* STEP 1: Purchase Data */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Datos de la Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6">
              {/* Row 1: Receipt Type, Payment Method, Date */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Tipo de Comprobante *
                  </Label>
                  <Select value={receiptType} onValueChange={setReceiptType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECEIPT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Forma de Pago *
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha de Compra *
                  </Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Supplier and Inventory */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Proveedor *
                  </Label>
                  {suppliersLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div className="flex gap-2">
                      <Select
                        value={selectedSupplierId}
                        onValueChange={setSelectedSupplierId}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Seleccionar proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setSupplierModalOpen(true)}
                        title="Crear nuevo proveedor"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Inventario *
                  </Label>
                  <Select
                    value={selectedInventoryId}
                    onValueChange={setSelectedInventoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar inventario" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventories.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Observaciones</Label>
                <Textarea
                  placeholder="Notas adicionales sobre la compra..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4">
                <Button
                  size="lg"
                  onClick={() => setCurrentStep(2)}
                  disabled={!canProceedToStep2()}
                >
                  <span>Agregar Productos</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Add Products */}
        {currentStep === 2 && (
          <>
            {/* Summary of Step 1 */}
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Proveedor:</span>{" "}
                    <Badge variant="secondary">
                      {getSelectedSupplierName()}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Comprobante:</span>{" "}
                    <span className="font-medium">
                      {
                        RECEIPT_TYPES.find((t) => t.value === receiptType)
                          ?.label
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pago:</span>{" "}
                    <span className="font-medium">
                      {
                        PAYMENT_METHODS.find((m) => m.value === paymentMethod)
                          ?.label
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fecha:</span>{" "}
                    <span className="font-medium">{purchaseDate}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Product Search */}
            <Card>
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Productos de {getSelectedSupplierName()}
                </CardTitle>
                <Button
                  variant="outline"
                  onClick={handleCreateProduct}
                  className="w-full md:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Producto Nuevo
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, SKU o variante..."
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          searchProducts(1);
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => searchProducts(1)}
                    disabled={productsLoading}
                  >
                    {productsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Products table */}
                <div className="rounded-md border max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Variantes</TableHead>
                        <TableHead className="text-center">
                          Stock Actual
                        </TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsLoading ? (
                        [...Array(3)].map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-12 mx-auto" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-8 w-20 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : products.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-6 text-muted-foreground"
                          >
                            {productsMeta
                              ? "No se encontraron productos de este proveedor"
                              : "Busca productos para agregar al carrito"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.map((product) => (
                          <TableRow key={product.variantId}>
                            <TableCell className="font-medium">
                              {product.productName}
                            </TableCell>
                            <TableCell>{product.sku}</TableCell>
                            <TableCell>
                              {Object.entries(product.attributes || {})
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" / ") || "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {product.physicalStock < 0 ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {product.physicalStock} (Reponer)
                                </Badge>
                              ) : product.physicalStock === 0 ? (
                                <Badge variant="outline">Sin stock</Badge>
                              ) : (
                                <span>{product.physicalStock}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                onClick={() => addToCart(product)}
                                disabled={cart.some(
                                  (item) =>
                                    item.variantId === product.variantId,
                                )}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Agregar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {productsMeta && productsMeta.totalPages > 1 && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={productsPage <= 1}
                      onClick={() => searchProducts(productsPage - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center text-sm text-muted-foreground">
                      Página {productsPage} de {productsMeta.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={productsPage >= productsMeta.totalPages}
                      onClick={() => searchProducts(productsPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shopping Cart */}
            <Card>
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 md:p-6">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {isEditMode
                    ? `Productos de la compra (${cart.length})`
                    : `Carrito de Compra (${cart.length} productos)`}
                </CardTitle>
                {cart.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCart}
                    className="w-full md:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Vaciar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>El carrito está vacío</p>
                    <p className="text-sm">
                      Busca y agrega productos para comprar
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Marca</TableHead>
                          <TableHead>Stock Actual</TableHead>
                          <TableHead className="text-center">
                            Cantidad
                          </TableHead>
                          <TableHead className="text-right">
                            Costo Unit.
                          </TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {item.productName}
                                </p>
                                {Object.keys(item.attributes || {}).length >
                                  0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {Object.entries(item.attributes)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(" / ")}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{item.sku}</TableCell>
                            <TableCell>{item.brandName || "—"}</TableCell>
                            <TableCell>
                              {item.currentStock < 0 ? (
                                <Badge variant="destructive">
                                  {item.currentStock}
                                </Badge>
                              ) : (
                                item.currentStock
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateCartItem(
                                    item.id,
                                    "quantity",
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                                className="w-20 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitCost}
                                onChange={(e) =>
                                  updateCartItem(
                                    item.id,
                                    "unitCost",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-24 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.quantity * item.unitCost)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* Summary Sidebar */}
      <aside className="w-full lg:w-80 border-t lg:border-l bg-muted/30 p-4 lg:p-6 flex flex-col shrink-0 overflow-y-auto">
        <h2 className="font-semibold text-lg mb-4">
          {isEditMode ? "Resumen de Edición" : "Resumen de Compra"}
        </h2>

        <div className="space-y-3 flex-1">
          {currentStep === 2 && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Proveedor:</span>
                <span className="font-medium">{getSelectedSupplierName()}</span>
              </div>
              <hr />
            </>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Productos:</span>
            <span>{cart.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Unidades totales:</span>
            <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
          </div>
          <hr />
          <div className="flex justify-between font-semibold text-lg">
            <span>Total:</span>
            <span>{formatCurrency(calculateTotal())}</span>
          </div>
        </div>

        <div className="space-y-2 mt-6">
          {currentStep === 2 && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!canSubmit() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? "Guardando..." : "Registrando..."}
                </>
              ) : isEditMode ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Cambios
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Registrar Compra
                </>
              )}
            </Button>
          )}

          {currentStep === 1 && (
            <p className="text-xs text-muted-foreground text-center">
              Completa los datos y selecciona un proveedor para continuar
            </p>
          )}

          {currentStep === 2 && !canSubmit() && cart.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Asegúrate de agregar cantidad para cada producto
            </p>
          )}
        </div>
      </aside>

      {/* Create Supplier Modal */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-supplier-name">Nombre del Proveedor *</Label>
              <Input
                id="new-supplier-name"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Ingrese el nombre"
                disabled={isCreatingSupplier}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSupplierModalOpen(false);
                setNewSupplierName("");
              }}
              disabled={isCreatingSupplier}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSupplier}
              disabled={isCreatingSupplier}
            >
              {isCreatingSupplier ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Proveedor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
