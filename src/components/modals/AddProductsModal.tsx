"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { InventoryItemForSale } from "@/interfaces/IProduct";

interface CartItem {
  id: string;
  inventoryItemId: string;
  variantId: string;
  productName: string;
  sku: string;
  attributes?: Record<string, string>;
  quantity: number;
  price: number;
}

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onProductsAdded?: () => void;
}

export default function AddProductsModal({
  open,
  orderId,
  onClose,
  onProductsAdded,
}: Props) {
  const { auth, inventories } = useAuth();
  const [query, setQuery] = useState("");
  const [allProducts, setAllProducts] = useState<InventoryItemForSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const inventoryId = inventories?.[0]?.id || "";

  // Auto-load products when modal opens
  useEffect(() => {
    const fetchAllProducts = async () => {
      if (!open || !inventoryId) return;

      setLoading(true);
      try {
        const res = await searchInventoryItems({
          inventoryId,
          page: 1,
          limit: 100, // Fetch a larger batch for local filtering
        });
        setAllProducts(res.data);
      } catch (err) {
        console.error("Error fetching products", err);
        toast.error("Error al cargar productos");
      } finally {
        setLoading(false);
      }
    };

    fetchAllProducts();
  }, [open, inventoryId]);

  // Local filtering
  const filteredProducts = useMemo(() => {
    if (!query) return allProducts;
    const lowerQuery = query.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.productName.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery),
    );
  }, [allProducts, query]);

  const addToCart = (product: InventoryItemForSale) => {
    setCart((prev) => {
      const existing = prev.find(
        (p) =>
          p.inventoryItemId === product.inventoryItemId &&
          p.variantId === product.variantId,
      );
      if (existing) {
        return prev.map((p) =>
          p.id === existing.id ? { ...p, quantity: p.quantity + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          inventoryItemId: product.inventoryItemId,
          variantId: product.variantId,
          productName: product.productName,
          sku: product.sku,
          attributes: product.attributes,
          quantity: 1,
          price: product.price,
        },
      ];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === cartItemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    setSubmitting(true);
    try {
      // Primero obtener el pedido actual para tener los items existentes
      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      );
      const currentOrder = orderRes.data;

      // Preparar los items existentes (sin modificar)
      const existingItems = currentOrder.items.map((item: any) => ({
        productVariantId: item.productVariantId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType || "NONE",
        discountAmount: item.discountAmount || 0,
        attributes: item.attributes,
      }));

      // Preparar los nuevos items con flag de promo
      const newItems = cart.map((item) => ({
        productVariantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        discountType: "NONE",
        discountAmount: 0,
        attributes: item.attributes,
        isPromoItem: true,
        addedByUserId: auth?.user?.id,
        addedAt: new Date().toISOString(),
      }));

      // Combinar todos los items
      const allItems = [...existingItems, ...newItems];

      // Actualizar el pedido
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          items: allItems,
          userId: auth?.user?.id ?? null,
        },
      );

      toast.success("Productos agregados correctamente");
      setCart([]);
      setAllProducts([]);
      setQuery("");
      onProductsAdded?.();
      onClose();
    } catch (err) {
      console.error("Error adding products", err);
      toast.error("Error al agregar productos");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCart([]);
    setAllProducts([]);
    setQuery("");
    onClose();
  };

  const cartTotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Agregar productos - Promo del día
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos por nombre o SKU..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista de productos */}
          {loading ? (
            <div className="flex items-center justify-center p-8 bg-muted/20 rounded-lg border border-dashed">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <p className="text-sm text-muted-foreground">
                Cargando productos...
              </p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {filteredProducts.map((product) => (
                <div
                  key={`${product.inventoryItemId}-${product.variantId}`}
                  className="p-3 flex items-center justify-between hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{product.productName}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>SKU: {product.sku}</span>
                      <span>•</span>
                      <span>S/{product.price.toFixed(2)}</span>
                      {product.availableStock <= 0 && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-xs">
                            Sin stock
                          </Badge>
                        </>
                      )}
                    </div>

                    {product.attributes && (
                      <div className="flex gap-1 mt-1">
                        {Object.entries(product.attributes).map(([k, v]) => (
                          <Badge
                            key={k}
                            variant="secondary"
                            className="text-xs"
                          >
                            {k}: {v}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addToCart(product)}
                    disabled={product.availableStock <= 0}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground p-6">
              No se encontraron productos
            </div>
          )}

          {/* Carrito */}
          {cart.length > 0 && (
            <div className="border border-primary/30 rounded-lg p-3 bg-primary/5">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Productos a agregar ({cart.length})
              </h4>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-background rounded p-2"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        S/{item.price.toFixed(2)} x {item.quantity} = S/
                        {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t flex justify-between items-center">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-lg">
                  S/{cartTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? "Agregando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
