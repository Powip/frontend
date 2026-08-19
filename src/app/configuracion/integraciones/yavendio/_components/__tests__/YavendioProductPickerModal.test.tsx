/**
 * Tests: YavendioProductPickerModal
 * (app/configuracion/integraciones/yavendio/_components/YavendioProductPickerModal.tsx)
 *
 * Comportamiento verificado (FEAT-13 Fase 3b, ver tasks/frontend.md "## Tests"):
 * 1. Lista de productos renderizada con badge "Activo" (`status: true`) o
 *    "Descontinuado" (`status: false`) según corresponda.
 * 2. Checkbox "Seleccionar todos" marca y desmarca todas las filas.
 * 3. Confirmar con 1 producto seleccionado → llama `syncYavendioProduct`
 *    exactamente una vez con el `productId` correcto.
 * 4. Confirmar con varios seleccionados → llama `syncYavendioProduct` una
 *    vez POR CADA uno, EN ORDEN estrictamente secuencial (nunca en
 *    paralelo) — se verifica con un mock que registra el orden de llamada
 *    y la concurrencia máxima real (nunca más de 1 invocación en vuelo).
 * 5. Un fallo en un producto NO aborta el loop: el resto de los
 *    seleccionados se sigue sincronizando, y el resumen final (`onComplete`)
 *    refleja el fallo en `errors` junto con los `created`/`updated` de los
 *    que sí funcionaron.
 * 6. Botón "Sincronizar seleccionados" deshabilitado con 0 productos
 *    seleccionados.
 * Adicional: al completar el loop se llama `onComplete(summary)` y
 * `onClose()`.
 *
 * Mocks aplicados:
 * - @/contexts/AuthContext → useAuth (token + companyId de fallback).
 * - @/services/productService → getCompanyProducts (nunca HTTP real).
 * - @/services/yavendioService → syncYavendioProduct (nunca HTTP real).
 * - @/components/ui/dialog → mock que renderiza children directamente
 *   cuando open=true (mismo criterio que SendToEvaGuideModal.test.tsx,
 *   evita depender del portal real de Radix en jsdom).
 * - @/components/ui/checkbox → mock de <input type="checkbox"> nativo que
 *   reenvía `data-testid`/`disabled` (Radix Checkbox no es necesario para
 *   estos tests de comportamiento).
 * - @/components/ui/button y @/components/ui/badge se usan SIN mockear:
 *   son wrappers triviales sobre <button>/<span> sin dependencias de
 *   browser APIs.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/productService', () => ({
  getCompanyProducts: jest.fn(),
}));

jest.mock('@/services/yavendioService', () => ({
  syncYavendioProduct: jest.fn(),
}));

jest.mock('@/components/ui/dialog', () => {
  const React = require('react');
  const Dialog = ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null;
  const DialogContent = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const DialogHeader = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle };
});

jest.mock('@/components/ui/checkbox', () => {
  const React = require('react');
  const Checkbox = ({
    checked,
    onCheckedChange,
    disabled,
    'data-testid': dataTestId,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    'data-testid'?: string;
  }) => (
    <input
      type="checkbox"
      data-testid={dataTestId}
      checked={checked === true}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  );
  return { Checkbox };
});

// ── Imports bajo prueba ────────────────────────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import { getCompanyProducts } from '@/services/productService';
import type { PowipProduct } from '@/services/productService';
import { syncYavendioProduct } from '@/services/yavendioService';
import type { CatalogSyncSummary, SyncProductResult } from '@/services/yavendioService';
import YavendioProductPickerModal from '../YavendioProductPickerModal';

// ── Casts ──────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.mocked(useAuth);
const mockGetCompanyProducts = jest.mocked(getCompanyProducts);
const mockSyncYavendioProduct = jest.mocked(syncYavendioProduct);

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_AUTH = {
  auth: {
    user: { id: 'user-1', email: 'admin@powip.com', role: 'ADMIN', permissions: [] },
    company: { id: 'company-1', name: 'Powip Test', stores: [] },
    accessToken: 'fake-token',
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: null,
  setSelectedStore: jest.fn(),
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

const PRODUCTS: PowipProduct[] = [
  { id: 'prod-1', name: 'Zapatilla Roja', sku: 'SKU-1', status: true, hasVariants: false },
  { id: 'prod-2', name: 'Camisa Descontinuada', sku: 'SKU-2', status: false, hasVariants: false },
  { id: 'prod-3', name: 'Gorra Azul', sku: 'SKU-3', status: true, hasVariants: false },
];

function okResult(productId: string, outcome: SyncProductResult['outcome'] = 'updated'): SyncProductResult {
  return { productId, companyId: 'company-1', outcome };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(MOCK_AUTH as unknown as ReturnType<typeof useAuth>);
  mockGetCompanyProducts.mockResolvedValue(PRODUCTS);
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderModal(overrides: Partial<{ open: boolean }> = {}) {
  const onClose = jest.fn();
  const onComplete = jest.fn();
  const utils = render(
    <YavendioProductPickerModal
      open={overrides.open ?? true}
      companyId="company-1"
      onClose={onClose}
      onComplete={onComplete}
    />,
  );
  return { ...utils, onClose, onComplete };
}

async function waitForProductsLoaded() {
  return screen.findByText('Zapatilla Roja');
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('YavendioProductPickerModal', () => {
  it('renderiza la lista de productos con badge "Activo" o "Descontinuado" según status', async () => {
    renderModal();
    await waitForProductsLoaded();

    const activeRow = screen.getByTestId('yavendio-picker-row-prod-1');
    expect(within(activeRow).getByText('Zapatilla Roja')).toBeInTheDocument();
    expect(within(activeRow).getByText('Activo')).toBeInTheDocument();
    expect(within(activeRow).queryByText('Descontinuado')).not.toBeInTheDocument();

    const discontinuedRow = screen.getByTestId('yavendio-picker-row-prod-2');
    expect(within(discontinuedRow).getByText('Camisa Descontinuada')).toBeInTheDocument();
    expect(within(discontinuedRow).getByText('Descontinuado')).toBeInTheDocument();
    expect(within(discontinuedRow).queryByText('Activo')).not.toBeInTheDocument();
  });

  it('llama a getCompanyProducts con el token y companyId correctos al abrirse', async () => {
    renderModal();
    await waitForProductsLoaded();
    expect(mockGetCompanyProducts).toHaveBeenCalledWith('fake-token', 'company-1');
  });

  it('"Seleccionar todos" marca y desmarca todas las filas', async () => {
    renderModal();
    await waitForProductsLoaded();

    const selectAll = screen.getByTestId('yavendio-picker-select-all');
    const user = userEvent.setup();

    await user.click(selectAll);
    for (const product of PRODUCTS) {
      const row = screen.getByTestId(`yavendio-picker-row-${product.id}`);
      expect(within(row).getByRole('checkbox')).toBeChecked();
    }
    expect(screen.getByRole('button', { name: /sincronizar seleccionados \(3\)/i })).toBeInTheDocument();

    await user.click(selectAll);
    for (const product of PRODUCTS) {
      const row = screen.getByTestId(`yavendio-picker-row-${product.id}`);
      expect(within(row).getByRole('checkbox')).not.toBeChecked();
    }
    expect(screen.getByRole('button', { name: /sincronizar seleccionados \(0\)/i })).toBeInTheDocument();
  });

  it('el botón de confirmar está deshabilitado con 0 productos seleccionados', async () => {
    renderModal();
    await waitForProductsLoaded();
    expect(
      screen.getByRole('button', { name: /sincronizar seleccionados \(0\)/i }),
    ).toBeDisabled();
  });

  it('confirmar con 1 producto seleccionado llama a syncYavendioProduct exactamente una vez con el productId correcto', async () => {
    mockSyncYavendioProduct.mockResolvedValue(okResult('prod-1', 'updated'));
    const { onComplete, onClose } = renderModal();
    await waitForProductsLoaded();

    const row = screen.getByTestId('yavendio-picker-row-prod-1');
    const user = userEvent.setup();
    await user.click(within(row).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /sincronizar seleccionados \(1\)/i }));

    await waitFor(() => expect(mockSyncYavendioProduct).toHaveBeenCalledTimes(1));
    expect(mockSyncYavendioProduct).toHaveBeenCalledWith('fake-token', 'company-1', 'prod-1');

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const summary: CatalogSyncSummary = onComplete.mock.calls[0][0];
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(0);
    expect(summary.failed).toBe(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirmar con varios seleccionados llama a syncYavendioProduct una vez por cada uno, en orden y nunca en paralelo', async () => {
    const callOrder: string[] = [];
    let inFlight = 0;
    let maxConcurrent = 0;

    mockSyncYavendioProduct.mockImplementation(async (_token, _companyId, productId) => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      callOrder.push(productId);
      await new Promise((resolve) => setTimeout(resolve, 15));
      inFlight -= 1;
      return okResult(productId, 'updated');
    });

    const { onComplete } = renderModal();
    await waitForProductsLoaded();

    const selectAll = screen.getByTestId('yavendio-picker-select-all');
    const user = userEvent.setup();
    await user.click(selectAll);
    await user.click(screen.getByRole('button', { name: /sincronizar seleccionados \(3\)/i }));

    await waitFor(() => expect(mockSyncYavendioProduct).toHaveBeenCalledTimes(3));

    // Nunca hubo más de 1 llamada "en vuelo" a la vez → serie estricta, nunca Promise.all.
    expect(maxConcurrent).toBe(1);
    // Orden estable, igual al orden de la lista original (no el de selección).
    expect(callOrder).toEqual(['prod-1', 'prod-2', 'prod-3']);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('un fallo en un producto no aborta el loop: el resto se sigue sincronizando y el resumen final refleja el error', async () => {
    mockSyncYavendioProduct.mockImplementation(async (_token, _companyId, productId) => {
      if (productId === 'prod-2') {
        return Promise.reject({
          response: { data: { message: 'Producto inválido en Yavendio' } },
        });
      }
      if (productId === 'prod-1') return okResult('prod-1', 'created');
      return okResult('prod-3', 'updated');
    });

    const { onComplete, onClose } = renderModal();
    await waitForProductsLoaded();

    const selectAll = screen.getByTestId('yavendio-picker-select-all');
    const user = userEvent.setup();
    await user.click(selectAll);
    await user.click(screen.getByRole('button', { name: /sincronizar seleccionados \(3\)/i }));

    // Los 3 productos se intentaron sincronizar — el fallo de prod-2 no cortó el loop.
    await waitFor(() => expect(mockSyncYavendioProduct).toHaveBeenCalledTimes(3));
    expect(mockSyncYavendioProduct).toHaveBeenNthCalledWith(1, 'fake-token', 'company-1', 'prod-1');
    expect(mockSyncYavendioProduct).toHaveBeenNthCalledWith(2, 'fake-token', 'company-1', 'prod-2');
    expect(mockSyncYavendioProduct).toHaveBeenNthCalledWith(3, 'fake-token', 'company-1', 'prod-3');

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const summary: CatalogSyncSummary = onComplete.mock.calls[0][0];
    expect(summary.created).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.failed).toBe(1);
    expect(summary.errors).toEqual([
      { productId: 'prod-2', sku: 'SKU-2', message: 'Producto inválido en Yavendio' },
    ]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
