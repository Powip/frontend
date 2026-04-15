import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, UploadCloud, File, AlertTriangle, CheckCircle } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface ImportSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  storeId: string;
  userId?: string;
  sellerName?: string;
}

export default function ImportSalesModal({
  isOpen,
  onClose,
  onSuccess,
  storeId,
  userId,
  sellerName,
}: ImportSalesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [report, setReport] = useState<{ successful: string[]; failed: { orderNumber: string; reason: string }[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/import/template`,
        { responseType: "blob" }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Plantilla_Ventas.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Plantilla descargada");
    } catch (error) {
      console.error("Error al descargar plantilla", error);
      toast.error("Hubo un error al descargar la plantilla");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      // Basic validation
      if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls") && !selected.name.endsWith(".csv")) {
        toast.error("Por favor, sube un archivo Excel (.xlsx, .xls) o .csv");
        return;
      }
      setFile(selected);
      setReport(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecciona un archivo primero");
      return;
    }

    try {
      setIsUploading(true);
      setReport(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("storeId", storeId);
      if (userId) formData.append("userId", userId);
      if (sellerName) formData.append("sellerName", sellerName);

      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/import/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const result = res.data;
      setReport(result);
      
      if (result.successful.length > 0) {
        toast.success(`${result.successful.length} órdenes importadas con éxito`);
        onSuccess(); // Trigger refresh on parent
      }

      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} órdenes tuvieron errores durante la importación`);
      }

    } catch (error: any) {
      console.error("Error al subir archivo", error);
      toast.error(error?.response?.data?.message || "Ocurrió un error general al procesar el archivo");
    } finally {
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const customClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={customClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Importar Ventas desde Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!report && (
            <>
              {/* Sección de Plantilla */}
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <File className="w-12 h-12 text-gray-400 mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">1. Descarga la plantilla oficial</h3>
                <p className="text-sm text-center text-gray-500 mb-4 max-w-sm">
                  Utiliza este archivo como base. Mantiene las cabeceras requeridas por el sistema para asegurar una carga exitosa.
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleDownloadTemplate} 
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Descargar Plantilla
                </Button>
              </div>

              {/* Sección de Carga */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">2. Sube tu archivo con datos</Label>
                <div 
                  className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg ${
                    file ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                  } hover:bg-gray-50 transition-colors cursor-pointer`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className={`w-10 h-10 mb-2 ${file ? "text-blue-500" : "text-gray-400"}`} />
                  {file ? (
                    <span className="text-sm font-medium text-blue-700">{file.name}</span>
                  ) : (
                    <span className="text-sm text-gray-500">Haz clic para seleccionar tu Excel</span>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </>
          )}

          {/* Reporte de Resultados */}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium">Importación Finalizada</p>
                  <p className="text-sm">{report.successful.length} órdenes (grupos de filas) procesadas correctamente.</p>
                </div>
              </div>

              {report.failed.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600 font-medium">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Órdenes Rechazadas ({report.failed.length})</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-[250px] overflow-y-auto">
                    <ul className="space-y-3 text-sm">
                      {report.failed.map((fail, idx) => (
                        <li key={idx} className="bg-white p-3 rounded shadow-sm border border-red-100">
                          <span className="font-semibold text-red-700 block mb-1">Orden: {fail.orderNumber}</span>
                          <span className="text-gray-700">{fail.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    * Las órdenes exitosas ya fueron guardadas. Por favor, corrige las filas de estas órdenes rechazadas en tu Excel y vuelve a subir el nuevo archivo modificado (o súbelo manualmente).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between items-center mt-2">
          {report ? (
             <Button variant="outline" onClick={resetState}>
               Subir otro archivo
             </Button>
          ) : (
            <Button variant="ghost" onClick={customClose} disabled={isUploading}>
              Cancelar
            </Button>
          )}

          {(!report && file) && (
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Comenzar Importación"
              )}
            </Button>
          )}

          {report && (
            <Button onClick={customClose}>
              Finalizar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
