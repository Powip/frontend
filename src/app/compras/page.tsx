"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Plus,
    Eye,
    Trash2,
    ShoppingCart,
    Package,
    Calendar,
    DollarSign,
    Pencil,
    User,
} from "lucide-react";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PurchaseItem {
    id: string;
    variantId: string;
    supplierId: string;
    supplierName: string;
    sku: string;
    productName: string;
    quantity: number;
    unitCost: number;
    attributes?: Record<string, string>;
}

interface Purchase {
    id: string;
    purchaseNumber: string;
    totalAmount: number;
    notes: string | null;
    status: "COMPLETED" | "CANCELLED";
    userEmail: string | null;
    supplierName: string | null;
    createdAt: string;
    items: PurchaseItem[];
}

const ITEMS_PER_PAGE = 10;

export default function ComprasPage() {
    const { auth } = useAuth();
    const router = useRouter();
    const companyId = auth?.company?.id;

    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Modal states
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    useEffect(() => {
        if (companyId) {
            fetchPurchases();
        }
    }, [companyId, currentPage]);

    const fetchPurchases = async () => {
        if (!companyId) return;
        setIsLoading(true);
        try {
            const res = await axios.get(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase/company/${companyId}`,
                {
                    params: { page: currentPage, limit: ITEMS_PER_PAGE },
                }
            );
            setPurchases(res.data.data);
            setTotalItems(res.data.meta.total);
        } catch (error) {
            console.error("Error fetching purchases", error);
            toast.error("Error al cargar compras");
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setDetailsOpen(true);
    };

    const handleEdit = (purchase: Purchase) => {
        // Redirigir a la página de edición con el ID de la compra
        router.push(`/registrar-compra?edit=${purchase.id}`);
    };

    const handleDelete = (purchase: Purchase) => {
        setPurchaseToDelete(purchase);
        setDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!purchaseToDelete) return;

        setIsDeleting(true);
        try {
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_INVENTORY}/purchase/${purchaseToDelete.id}`
            );

            toast.success("Compra eliminada y stock revertido");
            fetchPurchases();
        } catch (error) {
            console.error("Error deleting purchase", error);
            toast.error("Error al eliminar la compra");
        } finally {
            setIsDeleting(false);
            setDeleteOpen(false);
            setPurchaseToDelete(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-PE", {
            style: "currency",
            currency: "PEN",
        }).format(amount);
    };

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    return (
        <div className="w-full px-6 pb-6">
            <HeaderConfig
                title="Compras"
                description="Gestión de compras y reposición de inventario"
            />

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Historial de Compras
                    </CardTitle>
                    <Link href="/registrar-compra">
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nueva Compra
                        </Button>
                    </Link>
                </CardHeader>

                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="whitespace-nowrap">Número</TableHead>
                                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                                    <TableHead className="whitespace-nowrap">Proveedor</TableHead>
                                    <TableHead className="whitespace-nowrap">Usuario</TableHead>
                                    <TableHead className="text-center whitespace-nowrap"># Items</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                                    <TableHead className="text-center whitespace-nowrap">Estado</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : purchases.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No hay compras registradas
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    purchases.map((purchase) => (
                                        <TableRow key={purchase.id}>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {purchase.purchaseNumber}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {formatDate(purchase.createdAt)}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={purchase.supplierName || "—"}>
                                                {purchase.supplierName || "—"}
                                            </TableCell>
                                            <TableCell className="max-w-[150px] truncate" title={purchase.userEmail || "—"}>
                                                {purchase.userEmail || "—"}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {purchase.items.length}
                                            </TableCell>
                                            <TableCell className="text-right font-medium whitespace-nowrap">
                                                {formatCurrency(Number(purchase.totalAmount))}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge
                                                    variant={
                                                        purchase.status === "COMPLETED"
                                                            ? "default"
                                                            : "destructive"
                                                    }
                                                >
                                                    {purchase.status === "COMPLETED"
                                                        ? "Completada"
                                                        : "Cancelada"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleViewDetails(purchase)}
                                                        title="Ver detalles"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(purchase)}
                                                        title="Editar"
                                                        disabled={purchase.status === "CANCELLED"}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(purchase)}
                                                        title="Eliminar"
                                                        disabled={purchase.status === "CANCELLED" || isDeleting}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                {!isLoading && totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                        itemName="compras"
                    />
                )}
            </Card>

            {/* Modal de Detalles */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-5xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background/95 backdrop-blur-sm">
                    <DialogHeader className="p-6 pb-2 space-y-2 border-b">
                        <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                            <div className="p-2 bg-primary/10 rounded-md">
                                <Package className="h-6 w-6 text-primary" />
                            </div>
                            Detalles de Compra
                            <Badge variant={selectedPurchase?.status === "COMPLETED" ? "default" : "destructive"} className="ml-2 text-sm">
                                {selectedPurchase?.status === "COMPLETED" ? "Completada" : "Cancelada"}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-base text-muted-foreground">
                            ID: <span className="font-mono text-xs select-all">{selectedPurchase?.id}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {selectedPurchase && (
                        <div className="flex-1 overflow-auto bg-muted/10">
                            <div className="p-6 space-y-8">
                                {/* Info Stats */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col space-y-1.5 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                                        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                            <Package className="h-4 w-4" /> Número de Compra
                                        </span>
                                        <span className="text-xl font-bold tracking-tight">{selectedPurchase.purchaseNumber}</span>
                                    </div>

                                    <div className="flex flex-col space-y-1.5 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                                        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                            <Calendar className="h-4 w-4" /> Fecha de Registro
                                        </span>
                                        <span className="text-xl font-bold tracking-tight">{formatDate(selectedPurchase.createdAt)}</span>
                                    </div>

                                    <div className="flex flex-col space-y-1.5 p-4 rounded-xl border bg-card text-card-foreground shadow-sm">
                                        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                            <User className="h-4 w-4" /> Responsable
                                        </span>
                                        <span className="text-lg font-semibold break-all">
                                            {selectedPurchase.userEmail || "—"}
                                        </span>
                                    </div>

                                    <div className="flex flex-col space-y-1.5 p-4 rounded-xl border bg-primary/5 border-primary/20 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10">
                                            <DollarSign className="h-12 w-12" />
                                        </div>
                                        <span className="flex items-center gap-2 text-sm font-medium text-primary">
                                            <DollarSign className="h-4 w-4" /> Monto Total
                                        </span>
                                        <span className="text-2xl font-bold tracking-tight text-primary">
                                            {formatCurrency(Number(selectedPurchase.totalAmount))}
                                        </span>
                                    </div>
                                </div>

                                {/* Notes Section */}
                                {selectedPurchase.notes && (
                                    <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 text-orange-900">
                                        <h4 className="text-sm font-semibold mb-1 flex items-center gap-2">
                                            <Pencil className="h-3 w-3" /> Notas Adicionales
                                        </h4>
                                        <p className="text-sm leading-relaxed opacity-90">{selectedPurchase.notes}</p>
                                    </div>
                                )}

                                {/* Products Grid/Table */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                                            Productos Adquiridos
                                            <Badge variant="outline" className="ml-2 bg-background">
                                                {selectedPurchase.items.length} items
                                            </Badge>
                                        </h3>
                                    </div>

                                    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 hover:bg-muted/60">
                                                    <TableHead className="py-4 pl-6 w-[40%]">Producto / Detalles</TableHead>
                                                    <TableHead className="py-4">SKU</TableHead>
                                                    <TableHead className="py-4">Proveedor</TableHead>
                                                    <TableHead className="py-4 text-center">Cant.</TableHead>
                                                    <TableHead className="py-4 text-right">Costo Unit.</TableHead>
                                                    <TableHead className="py-4 pr-6 text-right">Subtotal</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedPurchase.items.map((item) => (
                                                    <TableRow key={item.id} className="hover:bg-muted/5 transition-colors">
                                                        <TableCell className="pl-6 py-4">
                                                            <div className="space-y-1">
                                                                <p className="font-semibold text-base text-foreground/90">{item.productName}</p>
                                                                {item.attributes && Object.keys(item.attributes).length > 0 && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(item.attributes).map(([k, v]) => (
                                                                            <Badge key={k} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                                                                                {k}: {v}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-sm text-muted-foreground">{item.sku}</TableCell>
                                                        <TableCell className="text-sm">{item.supplierName}</TableCell>
                                                        <TableCell className="text-center font-bold text-base bg-muted/5">{item.quantity}</TableCell>
                                                        <TableCell className="text-right text-muted-foreground">
                                                            {formatCurrency(Number(item.unitCost))}
                                                        </TableCell>
                                                        <TableCell className="pr-6 text-right font-bold text-foreground">
                                                            {formatCurrency(item.quantity * Number(item.unitCost))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={() => setDetailsOpen(false)}>
                            Cerrar Detalles
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Confirmación de Eliminación */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de eliminar esta compra?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción marcará la compra como cancelada y <span className="font-bold text-destructive">revertirá automáticamente el stock de los items al inventario</span>.
                            <br /><br />
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDelete();
                            }}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Eliminando..." : "Sí, revertir stock y eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
