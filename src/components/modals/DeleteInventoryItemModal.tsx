"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

interface Props {
    open: boolean;
    inventoryItemId: string | null;
    productName: string;
    sku: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function DeleteInventoryItemModal({
    open,
    inventoryItemId,
    productName,
    sku,
    onClose,
    onSuccess
}: Props) {
    const [confirmText, setConfirmText] = useState("");
    const [step, setStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const expectedText = "ELIMINAR";

    const handleFirstConfirm = () => {
        setStep(2);
    };

    const handleDelete = async () => {
        if (!inventoryItemId || confirmText !== expectedText) return;

        setIsSubmitting(true);
        try {
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/inventory-item/${inventoryItemId}`
            );
            toast.success("Producto eliminado del inventario");
            onSuccess?.();
            handleClose();
        } catch (error) {
            console.error("Error eliminando producto", error);
            toast.error("No se pudo eliminar el producto");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setConfirmText("");
        setStep(1);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Eliminar Producto del Inventario
                    </DialogTitle>
                </DialogHeader>

                {step === 1 ? (
                    <>
                        <DialogDescription className="space-y-3">
                            <p>¿Estás seguro que deseas eliminar el siguiente producto del inventario?</p>
                            <div className="bg-muted p-3 rounded-md">
                                <p className="font-semibold">{productName}</p>
                                <p className="text-sm text-muted-foreground">SKU: {sku}</p>
                            </div>
                            <p className="text-sm text-red-600 font-medium">
                                Esta acción no se puede deshacer.
                            </p>
                        </DialogDescription>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose}>
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleFirstConfirm}
                            >
                                Continuar
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogDescription className="space-y-4">
                            <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                                <p className="text-sm text-red-800">
                                    <strong>⚠️ Confirmación final</strong>
                                </p>
                                <p className="text-sm text-red-700 mt-1">
                                    Escribe <span className="font-mono font-bold">ELIMINAR</span> para confirmar la eliminación de:
                                </p>
                                <p className="font-semibold text-red-900 mt-2">{productName}</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Escribe ELIMINAR para confirmar</Label>
                                <Input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder="ELIMINAR"
                                    className="font-mono"
                                />
                            </div>
                        </DialogDescription>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                                Volver
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isSubmitting || confirmText !== expectedText}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Eliminar Definitivamente
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
