"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

interface Props {
    open: boolean;
    inventoryItemId: string | null;
    productName: string;
    currentStock: number;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddStockModal({
    open,
    inventoryItemId,
    productName,
    currentStock,
    onClose,
    onSuccess
}: Props) {
    const [quantity, setQuantity] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!inventoryItemId || quantity <= 0) return;

        setIsSubmitting(true);
        try {
            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/${inventoryItemId}/add-stock`,
                { quantity }
            );
            toast.success(`Se agregaron ${quantity} unidades al stock`);
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

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Agregar Stock</DialogTitle>
                    <DialogDescription>
                        {productName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="text-center text-sm text-muted-foreground">
                        Stock actual: <span className="font-semibold text-foreground">{currentStock} unidades</span>
                    </div>

                    <div className="space-y-2">
                        <Label>Cantidad a agregar</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                disabled={quantity <= 1}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>

                            <Input
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                className="text-center"
                            />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setQuantity(quantity + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="text-center text-sm">
                        Nuevo stock: <span className="font-semibold text-teal-600">{currentStock + quantity} unidades</span>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || quantity <= 0}
                        className="bg-teal-600 hover:bg-teal-700"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Agregando...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar Stock
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
