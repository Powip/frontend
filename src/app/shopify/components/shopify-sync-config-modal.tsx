'use client';

import { useState } from 'react';
import axiosAuth from '@/lib/axiosAuth';
import { GATEWAY } from '@/lib/gateway';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ShopifySyncConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopUrl: string;
  companyId: string;
  storeId: string;
}

export function ShopifySyncConfigModal({
  isOpen,
  onClose,
  shopUrl,
  companyId,
  storeId,
}: ShopifySyncConfigModalProps) {
  const { auth } = useAuth();
  const [ventasStartDate, setVentasStartDate] = useState('2025-01-01');
  const [checkoutsEnabled, setCheckoutsEnabled] = useState(false);
  const [checkoutsStartDate, setCheckoutsStartDate] = useState('2025-01-01');
  const [productStrategy, setProductStrategy] = useState<'all' | 'from_orders'>('all');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await axiosAuth.post(
        `${GATEWAY.integrations}/shopify/confirm-sync/${shopUrl}`,
        {
          companyId,
          storeId,
          ventas: { startDate: new Date(ventasStartDate).toISOString() },
          checkouts: {
            enabled: checkoutsEnabled,
            startDate: checkoutsEnabled
              ? new Date(checkoutsStartDate).toISOString()
              : undefined,
          },
          products: { strategy: productStrategy },
        },
      );
      setSuccess(true);
      toast.success('Sincronizacion iniciada correctamente');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al iniciar sincronizacion';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setVentasStartDate('2025-01-01');
    setCheckoutsEnabled(false);
    setCheckoutsStartDate('2025-01-01');
    setProductStrategy('all');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {success ? 'Sincronizacion iniciada' : 'Configurar sincronizacion inicial'}
          </DialogTitle>
          {!success && (
            <p className="text-sm text-muted-foreground">Tienda: {shopUrl}</p>
          )}
        </DialogHeader>

        {success ? (
          <div className="py-4">
            <p className="text-gray-600">
              Los datos se estan importando en segundo plano. Podes cerrar esta ventana.
            </p>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Ventas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importar ventas desde
              </label>
              <input
                type="date"
                value={ventasStartDate}
                onChange={(e) => setVentasStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Checkouts */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="checkouts-enabled"
                  checked={checkoutsEnabled}
                  onChange={(e) => setCheckoutsEnabled(e.target.checked)}
                  className="rounded"
                />
                <label
                  htmlFor="checkouts-enabled"
                  className="text-sm font-medium text-gray-700 cursor-pointer"
                >
                  Importar carritos abandonados
                </label>
              </div>
              {checkoutsEnabled && (
                <input
                  type="date"
                  value={checkoutsStartDate}
                  onChange={(e) => setCheckoutsStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}
            </div>

            {/* Productos */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Estrategia de productos
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    name="productStrategy"
                    value="all"
                    checked={productStrategy === 'all'}
                    onChange={() => setProductStrategy('all')}
                  />
                  Importar todo el catalogo
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    name="productStrategy"
                    value="from_orders"
                    checked={productStrategy === 'from_orders'}
                    onChange={() => setProductStrategy('from_orders')}
                  />
                  Solo productos de las ventas importadas
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {success ? (
            <Button
              onClick={handleClose}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              Cerrar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-[160px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  'Iniciar sincronizacion'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
