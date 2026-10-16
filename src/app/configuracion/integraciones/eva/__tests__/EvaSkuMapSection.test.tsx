import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('@/services/evaService', () => ({
  getEvaSkuMap: jest.fn(),
  saveEvaSkuMap: jest.fn(),
  deleteEvaSkuMapping: jest.fn(),
}));
jest.mock('@/services/inventoryCatalogService', () => ({ fetchBusinessInventories: jest.fn() }));
jest.mock('@/services/businessInventoryItemsService', () => ({ fetchBusinessInventoryItems: jest.fn() }));

import { toast } from 'sonner';
import { getEvaSkuMap, saveEvaSkuMap, deleteEvaSkuMapping } from '@/services/evaService';
import { fetchBusinessInventories } from '@/services/inventoryCatalogService';
import { fetchBusinessInventoryItems } from '@/services/businessInventoryItemsService';
import EvaSkuMapSection from '../_components/EvaSkuMapSection';

const mockGetSkuMap = jest.mocked(getEvaSkuMap);
const mockSaveSkuMap = jest.mocked(saveEvaSkuMap);
const mockDeleteMapping = jest.mocked(deleteEvaSkuMapping);
const mockFetchInventories = jest.mocked(fetchBusinessInventories);
const mockFetchItems = jest.mocked(fetchBusinessInventoryItems);

const ROWS = [
  { inventoryItemId: 'i1', variantId: 'v1', productName: 'Billetera', sku: 'SINSIN-1', attributes: { Color: 'Gris' }, inventoryId: 'inv1', storeId: 's1' },
  { inventoryItemId: 'i2', variantId: 'v1', productName: 'Billetera', sku: 'SINSIN-1', attributes: { Color: 'Gris' }, inventoryId: 'inv2', storeId: 's1' },
  { inventoryItemId: 'i3', variantId: 'v2', productName: 'Monedero', sku: 'SINSIN-2', inventoryId: 'inv1', storeId: 's1' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchInventories.mockResolvedValue([{ id: 'inv1' }, { id: 'inv2' }] as never);
  mockFetchItems.mockResolvedValue(ROWS as never);
  mockGetSkuMap.mockResolvedValue([{ variantId: 'v2', evaSku: 'FEMI070', powipSku: 'SINSIN-2', productName: 'Monedero', updatedAt: '' }]);
  mockSaveSkuMap.mockResolvedValue([]);
  mockDeleteMapping.mockResolvedValue(undefined);
});

it('lista cada variante una vez con su código actual', async () => {
  render(<EvaSkuMapSection companyId="company-1" token="tk" />);
  expect(await screen.findAllByLabelText('SKU EVA de Billetera (Gris)')).toHaveLength(1);
  expect(screen.getByLabelText('SKU EVA de Monedero')).toHaveValue('FEMI070');
});

it('guardar manda los cambios con PUT y los vaciados con DELETE', async () => {
  render(<EvaSkuMapSection companyId="company-1" token="tk" />);
  await userEvent.type(await screen.findByLabelText('SKU EVA de Billetera (Gris)'), ' FEMI064 ');
  await userEvent.clear(screen.getByLabelText('SKU EVA de Monedero'));
  await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
  expect(mockSaveSkuMap).toHaveBeenCalledWith('tk', 'company-1', [
    { variantId: 'v1', evaSku: 'FEMI064', powipSku: 'SINSIN-1', productName: 'Billetera' },
  ]);
  expect(mockDeleteMapping).toHaveBeenCalledWith('tk', 'company-1', 'v2');
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
});

it('un código inválido deshabilita guardar', async () => {
  render(<EvaSkuMapSection companyId="company-1" token="tk" />);
  await userEvent.type(await screen.findByLabelText('SKU EVA de Billetera (Gris)'), 'A,B');
  expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
});

it('el buscador filtra por nombre o SKU', async () => {
  render(<EvaSkuMapSection companyId="company-1" token="tk" />);
  await screen.findByLabelText('SKU EVA de Billetera (Gris)');
  await userEvent.type(screen.getByPlaceholderText(/buscar producto/i), 'moned');
  expect(screen.queryByLabelText('SKU EVA de Billetera (Gris)')).not.toBeInTheDocument();
  expect(screen.getByLabelText('SKU EVA de Monedero')).toBeInTheDocument();
});

it('si falla la carga muestra el error', async () => {
  mockFetchInventories.mockRejectedValue(new Error('boom'));
  render(<EvaSkuMapSection companyId="company-1" token="tk" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
});
