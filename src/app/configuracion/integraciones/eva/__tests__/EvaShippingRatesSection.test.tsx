import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('@/services/evaService', () => ({
  getEvaShippingRates: jest.fn(),
  saveEvaShippingRates: jest.fn(),
  getEvaDistricts: jest.fn(),
}));

/** Mismo mock del Combobox que los tests de los modales EVA: opciones como botones. */
jest.mock('@/components/ui/combobox', () => {
  const Combobox = ({
    onValueChange,
    options,
  }: {
    onValueChange?: (value: string) => void;
    options?: Array<{ value: string; label: string }>;
  }) => (
    <ul>
      {(options ?? []).map((opt) => (
        <li key={opt.value}>
          <button type="button" onClick={() => onValueChange?.(opt.value)}>
            {opt.label}
          </button>
        </li>
      ))}
    </ul>
  );
  return { Combobox };
});

import { toast } from 'sonner';
import { getEvaShippingRates, saveEvaShippingRates, getEvaDistricts } from '@/services/evaService';
import EvaShippingRatesSection from '../_components/EvaShippingRatesSection';

const mockGetRates = jest.mocked(getEvaShippingRates);
const mockSaveRates = jest.mocked(saveEvaShippingRates);
const mockGetDistricts = jest.mocked(getEvaDistricts);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRates.mockResolvedValue({ defaultCost: 10, districts: { MIRAFLORES: 12.5 } });
  mockGetDistricts.mockResolvedValue(['MIRAFLORES', 'SURCO']);
  mockSaveRates.mockImplementation((_t, _c, rates) => Promise.resolve(rates));
});

it('muestra el costo por defecto y los distritos cargados', async () => {
  render(<EvaShippingRatesSection companyId="company-1" token="tk" />);
  expect(await screen.findByLabelText(/costo por defecto/i)).toHaveValue(10);
  expect(screen.getByLabelText('Costo MIRAFLORES')).toHaveValue(12.5);
});

it('agregar un distrito y guardar manda la tarifa completa', async () => {
  render(<EvaShippingRatesSection companyId="company-1" token="tk" />);
  await screen.findByLabelText(/costo por defecto/i);
  await userEvent.click(screen.getByRole('button', { name: /agregar distrito/i }));
  expect(screen.queryByRole('button', { name: 'MIRAFLORES' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'SURCO' }));
  await userEvent.type(screen.getByLabelText('Costo SURCO'), '15');
  await userEvent.click(screen.getByRole('button', { name: /guardar tarifas/i }));
  expect(mockSaveRates).toHaveBeenCalledWith('tk', 'company-1', { defaultCost: 10, districts: { MIRAFLORES: 12.5, SURCO: 15 } });
  expect(toast.success).toHaveBeenCalled();
});

it('quitar un distrito y vaciar el costo por defecto guarda null y sin ese distrito', async () => {
  render(<EvaShippingRatesSection companyId="company-1" token="tk" />);
  await userEvent.clear(await screen.findByLabelText(/costo por defecto/i));
  await userEvent.click(screen.getByRole('button', { name: 'Quitar MIRAFLORES' }));
  await userEvent.click(screen.getByRole('button', { name: /guardar tarifas/i }));
  expect(mockSaveRates).toHaveBeenCalledWith('tk', 'company-1', { defaultCost: null, districts: {} });
});

it('un distrito agregado sin costo deshabilita guardar', async () => {
  render(<EvaShippingRatesSection companyId="company-1" token="tk" />);
  await screen.findByLabelText(/costo por defecto/i);
  await userEvent.click(screen.getByRole('button', { name: /agregar distrito/i }));
  await userEvent.click(screen.getByRole('button', { name: 'SURCO' }));
  expect(screen.getByRole('button', { name: /guardar tarifas/i })).toBeDisabled();
});

it('si el backend rechaza muestra su mensaje', async () => {
  mockSaveRates.mockRejectedValue({ response: { data: { message: 'Distritos no válidos para EVA: X' } } });
  render(<EvaShippingRatesSection companyId="company-1" token="tk" />);
  await screen.findByLabelText(/costo por defecto/i);
  await userEvent.click(screen.getByRole('button', { name: /guardar tarifas/i }));
  expect(toast.error).toHaveBeenCalledWith('Distritos no válidos para EVA: X');
});
