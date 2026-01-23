"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
    ArrowLeft,
    Plus,
    Trash2,
    Search,
    ShoppingCart,
    Package,
    AlertTriangle,
    Loader2,
    Save,
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



export default function RegistrarCompraPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editPurchaseId = searchParams.get("edit");

    const { auth, selectedStoreId, inventories } = useAuth();

    const companyId = auth?.company?.id;

    // Edit mode
    const [isEditMode, setIsEditMode] = useState(false);
    const [editPurchaseData, setEditPurchaseData] = useState<PurchaseData | null>(null);
    const [isLoadingPurchase, setIsLoadingPurchase] = useState(false);

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

    // Notes
    const [notes, setNotes] = useState("");

    // Submitting
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase/${purchaseId}`
            );

            const purchase = res.data;
            setEditPurchaseData(purchase);
            setSelectedInventoryId(purchase.inventoryId);
            setNotes(purchase.notes || "");

            // Convert purchase items to cart items and fetch current stock
            const cartItemsPromises = purchase.items.map(async (item) => {
                // Fetch current stock from inventory
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
                        }
                    );
                    const variant = stockRes.data.data.find(
                        (v: ProductVariant) => v.variantId === item.variantId
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
                `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/suppliers/company/${companyId}`
            );
            setSuppliers(res.data.filter((s) => s.isActive));
        } catch (error) {
            console.error("Error fetching suppliers", error);
            toast.error("Error al cargar proveedores");
        } finally {
            setSuppliersLoading(false);
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
                }
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

    const addToCart = (product: ProductVariant) => {
        // Check if already in cart
        const existing = cart.find((item) => item.variantId === product.variantId);
        if (existing) {
            toast.warning("Este producto ya está en el carrito");
            return;
        }

        // Use supplier from product if available, otherwise use first supplier
        const productSupplier = product.supplierId && product.supplierName
            ? { id: product.supplierId, name: product.supplierName }
            : suppliers[0];

        const newItem: CartItem = {
            id: crypto.randomUUID(),
            inventoryItemId: product.inventoryItemId,
            variantId: product.variantId,
            productName: product.productName,
            sku: product.sku,
            attributes: product.attributes,
            quantity: 1,
            unitCost: product.priceBase || 0,
            supplierId: productSupplier?.id || "",
            supplierName: productSupplier?.name || "",
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
        field: "quantity" | "unitCost" | "supplierId",
        value: number | string
    ) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.id !== cartItemId) return item;

                if (field === "supplierId") {
                    const supplier = suppliers.find((s) => s.id === value);
                    return {
                        ...item,
                        supplierId: value as string,
                        supplierName: supplier?.name || "",
                    };
                }

                return { ...item, [field]: value };
            })
        );
    };

    const handleCreateProduct = () => {
        router.push("/productos");
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    };

    const canSubmit = () => {
        if (cart.length === 0) return false;
        if (!selectedInventoryId) return false;

        // All items must have supplier and quantity > 0
        return cart.every(
            (item) =>
                item.supplierId && item.quantity > 0 && item.unitCost >= 0
        );
    };

    const handleSubmit = async () => {
        if (!canSubmit()) {
            toast.error("Completa todos los campos del carrito");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                companyId,
                storeId: selectedStoreId,
                inventoryId: selectedInventoryId,
                notes: notes || null,
                userEmail: auth?.user?.email || null,
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
                // Full update - reverts old stock, applies new
                await axios.put(
                    `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase/${editPurchaseData.id}`,
                    payload
                );
                toast.success("Compra actualizada correctamente");
            } else {
                // Create new purchase
                await axios.post(
                    `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase`,
                    payload
                );
                toast.success("Compra registrada correctamente");

                // Clear cart from state
                setCart([]);
                setNotes("");
            }

            // Redirect to purchases list
            router.push("/compras");
        } catch (error) {
            console.error("Error saving purchase", error);
            toast.error(isEditMode ? "Error al actualizar la compra" : "Error al registrar la compra");
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
        <div className="flex h-screen w-full">
            {/* Main content */}
            <main className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/compras">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Volver
                        </Button>
                    </Link>
                    <HeaderConfig
                        title={isEditMode ? `Editar Compra - ${editPurchaseData?.purchaseNumber}` : "Registrar Compra"}
                        description={isEditMode ? "Modifica los datos de la compra" : "Agrega productos al carrito para reponer inventario"}
                    />
                </div>

                {/* Inventory Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Inventario</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Seleccionar Inventario</Label>
                                <Select
                                    value={selectedInventoryId}
                                    onValueChange={setSelectedInventoryId}
                                >
                                    <SelectTrigger className="w-full">
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
                    </CardContent>
                </Card>

                {/* Product Search */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Buscar Productos
                        </CardTitle>
                        <Button variant="outline" onClick={handleCreateProduct}>
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
                            <Button onClick={() => searchProducts(1)} disabled={productsLoading}>
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
                                        <TableHead className="text-center">Stock Actual</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {productsLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : products.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                                {productsMeta ? "No se encontraron productos" : "Busca productos para agregar al carrito"}
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
                                                            (item) => item.variantId === product.variantId
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
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            {isEditMode ? `Productos de la compra (${cart.length})` : `Carrito de Compra (${cart.length} productos)`}
                        </CardTitle>
                        {cart.length > 0 && (
                            <Button variant="outline" size="sm" onClick={clearCart}>
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
                                <p className="text-sm">Busca y agrega productos para comprar</p>
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>Marca</TableHead>
                                            {!isEditMode && <TableHead>Stock Actual</TableHead>}
                                            <TableHead>Proveedor</TableHead>
                                            <TableHead className="text-center">Cantidad</TableHead>
                                            <TableHead className="text-right">Costo Unit.</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                            {!isEditMode && <TableHead></TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cart.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{item.productName}</p>
                                                        {Object.keys(item.attributes || {}).length > 0 && (
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
                                                {!isEditMode && (
                                                    <TableCell>
                                                        {item.currentStock < 0 ? (
                                                            <Badge variant="destructive">
                                                                {item.currentStock}
                                                            </Badge>
                                                        ) : (
                                                            item.currentStock
                                                        )}
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <Select
                                                        value={item.supplierId}
                                                        onValueChange={(value) =>
                                                            updateCartItem(item.id, "supplierId", value)
                                                        }

                                                    >
                                                        <SelectTrigger className="w-40">
                                                            <SelectValue placeholder="Seleccionar" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {suppliers.map((supplier) => (
                                                                <SelectItem key={supplier.id} value={supplier.id}>
                                                                    {supplier.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
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
                                                                parseInt(e.target.value) || 1
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
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        className="w-24 text-right"

                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(item.quantity * item.unitCost)}
                                                </TableCell>
                                                {!isEditMode && (
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeFromCart(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Notas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            placeholder="Notas adicionales sobre la compra..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </CardContent>
                </Card>
            </main>

            {/* Summary Sidebar */}
            <aside className="w-80 border-l bg-muted/30 p-6 flex flex-col">
                <h2 className="font-semibold text-lg mb-4">
                    {isEditMode ? "Resumen de Edición" : "Resumen de Compra"}
                </h2>

                <div className="space-y-3 flex-1">
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

                    {!canSubmit() && cart.length > 0 && !isEditMode && (
                        <p className="text-xs text-muted-foreground text-center">
                            Asegúrate de seleccionar proveedor y cantidad para cada producto
                        </p>
                    )}

                    {isEditMode && (
                        <p className="text-xs text-muted-foreground text-center">
                            Puedes modificar cantidades, precios y proveedores de los productos existentes.
                        </p>
                    )}
                </div>
            </aside>
        </div>
    );
}
