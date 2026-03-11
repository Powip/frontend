"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, Plus, Minus, Package, Info } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { InventoryItemForSale } from "@/interfaces/IProduct";

interface Props {
    open: boolean;
    item: InventoryItemForSale | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddStockModal({
    open,
    item,
    onClose,
    onSuccess
}: Props) {
    const { auth } = useAuth();
    const [quantity, setQuantity] = useState<number | ""> (1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!item) return null;

    const handleSubmit = async () => {
        const qty = Number(quantity);
        if (!item.inventoryItemId || qty === 0) {
            toast.error("La cantidad debe ser distinta de 0");
            return;
        }

        if (item.physicalStock + qty < 0) {
            toast.error("El stock final no puede ser negativo");
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/${item.inventoryItemId}/add-stock`,
                { 
                    quantity,
                    userEmail: auth?.user.email,
                    userName: auth?.user.name,
                    companyId: auth?.company?.id,
                    referenceId: "MANUAL_ADJUSTMENT"
                }
            );
            toast.success(`Se ajustaron ${qty} unidades al stock de "${item.productName}"`);
            onSuccess?.();
            handleClose();
        } catch (error) {
            console.error("Error agregando stock", error);
            toast.error("No se pudo agregar el stock");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setQuantity(1);
        onClose();
    };

    const attributesString = item.attributes 
        ? Object.entries(item.attributes)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" / ")
        : "";

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-teal-600" />
                        Ajustar Stock de Producto
                    </DialogTitle>
                    <DialogDescription>
                        Ingresa la cantidad de unidades que deseas sumar al stock actual.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Información del Producto */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2 border">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-base">{item.productName}</h4>
                                <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-medium text-teal-600">Precio Vta: ${item.priceVta}</p>
                                <p className="text-[10px] text-muted-foreground">Base: ${item.priceBase}</p>
                            </div>
                        </div>
                        {attributesString && (
                            <div className="pt-1 border-t mt-1">
                                <p className="text-xs text-muted-foreground italic">
                                    Variante: {attributesString}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Resumen de Stock */}
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-3 bg-secondary/20 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Stock Actual</p>
                            <p className="text-xl font-bold">{item.physicalStock}</p>
                        </div>
                        <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-100 dark:border-teal-900/30">
                            <p className="text-xs text-teal-600 dark:text-teal-400 mb-1">Stock Final</p>
                            <p className="text-xl font-bold text-teal-700 dark:text-teal-300">
                                {item.physicalStock + Number(quantity || 0)}
                            </p>
                        </div>
                    </div>

                    {/* Input de Cantidad */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm font-medium">Cantidad a agregar</Label>
                            <span className="text-xs text-teal-600 font-semibold">{Number(quantity || 0) >= 0 ? "+" : ""}{quantity || 0} unidades</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => setQuantity(Number(quantity || 0) - 1)}
                                disabled={isSubmitting}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>

                            <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "") {
                                        setQuantity("");
                                    } else {
                                        setQuantity(parseInt(val) || 0);
                                    }
                                }}
                                className="text-center h-10 text-lg font-semibold"
                                disabled={isSubmitting}
                            />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => setQuantity(Number(quantity || 0) + 1)}
                                disabled={isSubmitting}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>Esta acción quedará registrada en el historial bajo tu usuario ({auth?.user.name || auth?.user.email}).</p>
                    </div>
                </div>

                <DialogFooter className="gap-4 sm:gap-4 justify-center sm:justify-center">
                    <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || Number(quantity || 0) === 0}
                        className="bg-teal-600 hover:bg-teal-700 text-white min-w-[140px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Confirmar Ajuste
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
