'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { GATEWAY } from '@/lib/gateway';
import {
  getAbandonedCheckouts,
  getAbandonedCheckoutStats,
  getShopifyStatus,
  AbandonedCheckout,
  AbandonedCheckoutStats,
  FindAllResult,
} from '@/services/abandonedCheckoutsService';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto',
  RECOVERED: 'Recuperado',
  EXPIRED: 'Expirado',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  RECOVERED: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
};

export default function CarritosAbandonadosPage() {
  const { auth, selectedStoreId } = useAuth();
  const [result, setResult] = useState<FindAllResult | null>(null);
  const [stats, setStats] = useState<AbandonedCheckoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthShopUrl, setReauthShopUrl] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchData = useCallback(async () => {
    if (!auth?.accessToken) return;
    
    const companyId = auth.company?.id;

    setLoading(true);
    setError(null);
    try {
      const [checkoutsResult, statsResult] = await Promise.all([
        getAbandonedCheckouts({
          page,
          limit,
          status: statusFilter || undefined,
          companyId,
          storeId: selectedStoreId || undefined,
        }),
        getAbandonedCheckoutStats(companyId),
      ]);
      setResult(checkoutsResult);
      setStats(statsResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar carritos');
    } finally {
      setLoading(false);
    }

    if (companyId) {
      try {
        const stores = await getShopifyStatus(companyId);
        const reauthStore = stores.find((s) => s.needs_reauthorization);
        if (reauthStore) {
          setNeedsReauth(true);
          setReauthShopUrl(reauthStore.shop_url);
        }
      } catch {
        // no bloquear si falla
      }
    }
  }, [auth?.accessToken, auth?.company?.id, selectedStoreId, page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = result ? Math.ceil(result.total / limit) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Carritos Abandonados</h1>

      {needsReauth && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <span className="mt-0.5 text-lg">⚠️</span>
          <div>
            <p className="font-medium">Tu tienda Shopify necesita re-autorizarse</p>
            <p className="text-sm mt-1">
              Los scopes del token no incluyen los permisos de fulfillment. Los datos pueden estar incompletos.{' '}
              <a
                href={`${GATEWAY.integrations}/shopify/reauth/${reauthShopUrl}`}
                className="underline font-medium"
              >
                Reconectar tienda
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Abiertos</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.open}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Recuperados</p>
            <p className="text-2xl font-bold text-green-600">{stats.recovered}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Tasa de recuperación</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.recoveryRate.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['', 'OPEN', 'RECOVERED', 'EXPIRED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            {s === '' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : (
        <>
          <div className="bg-white border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Cliente
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Email
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Ítems
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(result?.data ?? []).map((checkout: AbandonedCheckout) => (
                  <tr key={checkout.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {checkout.customerFirstName || checkout.customerLastName
                        ? `${checkout.customerFirstName ?? ''} ${checkout.customerLastName ?? ''}`.trim()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {checkout.customerEmail ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {checkout.totalPrice != null
                        ? `${checkout.currency ?? ''} ${checkout.totalPrice.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {checkout.itemsData?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {checkout.abandonedAt
                        ? new Date(checkout.abandonedAt).toLocaleDateString('es-PE')
                        : new Date(checkout.createdAt).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[checkout.status]}`}
                      >
                        {STATUS_LABELS[checkout.status]}
                      </span>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      No hay carritos abandonados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
              <span>
                Página {page} de {totalPages} ({result?.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
