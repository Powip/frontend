"use client";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Upload, X, FileImage, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

interface Props {
    open: boolean;
    paymentId: string | null;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function PaymentProofUploadModal({ open, paymentId, onClose, onSuccess }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validar tipo de archivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(selectedFile.type)) {
            toast.error("Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.");
            return;
        }

        // Validar tamaño (máximo 5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            toast.error("El archivo es muy grande. Máximo 5MB.");
            return;
        }

        setFile(selectedFile);

        // Crear preview si es imagen
        if (selectedFile.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        } else {
            setPreview(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !paymentId) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            await axios.patch(
                `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/upload-proof`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            toast.success("Comprobante subido correctamente");
            onSuccess?.();
            handleClose();
        } catch (error) {
            console.error("Error subiendo comprobante", error);
            toast.error("No se pudo subir el comprobante");
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreview(null);
        onClose();
    };

    const clearFile = () => {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Subir Comprobante de Pago</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Área de subida */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${file ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-gray-400'}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {!file ? (
                            <div className="space-y-2">
                                <Upload className="h-10 w-10 mx-auto text-gray-400" />
                                <p className="text-sm text-gray-600">
                                    Haz clic para seleccionar un archivo
                                </p>
                                <p className="text-xs text-gray-400">
                                    JPG, PNG, WEBP o PDF (máx. 5MB)
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {preview ? (
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className="max-h-40 mx-auto rounded-md"
                                    />
                                ) : (
                                    <FileText className="h-10 w-10 mx-auto text-teal-600" />
                                )}
                                <p className="text-sm text-gray-600 truncate">{file.name}</p>
                                <p className="text-xs text-gray-400">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Botón para quitar archivo */}
                    {file && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                clearFile();
                            }}
                            className="w-full"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Quitar archivo
                        </Button>
                    )}

                    {/* Acciones */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={handleClose} disabled={uploading}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="bg-teal-600 hover:bg-teal-700"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Subiendo...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Subir Comprobante
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
