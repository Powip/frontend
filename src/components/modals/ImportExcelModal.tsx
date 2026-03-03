"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ExcelImportWizard from "@/components/excel/ExcelImportWizard";

interface ImportExcelModalProps {
  open: boolean;
  onClose: () => void;
  inventoryId: string;
  onSuccess: () => void;
}

export default function ImportExcelModal({
  open,
  onClose,
  inventoryId,
  onSuccess,
}: ImportExcelModalProps) {
  const handleBack = () => {
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Productos desde Excel</DialogTitle>
          <DialogDescription>
            Utilizá el asistente para importar productos de forma masiva.
          </DialogDescription>
        </DialogHeader>
        <ExcelImportWizard onBack={handleBack} />
      </DialogContent>
    </Dialog>
  );
}
