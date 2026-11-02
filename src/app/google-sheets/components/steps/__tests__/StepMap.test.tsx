import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepMap } from '../StepMap';
import { preview } from './fixtures';

const setup = (onSave = jest.fn()) =>
  render(<StepMap preview={preview} storeId="s1" tabIds={[1, 2]} loading={false} onSave={onSave} />);

const optionTexts = (label: string) =>
  within(screen.getByRole('combobox', { name: label })).getAllByRole('option').map((o) => o.textContent);

it('precarga la sugerencia y lista encabezados reales', () => {
  setup();
  expect(screen.getByRole('combobox', { name: 'Nombre del cliente' })).toHaveValue('Cliente');
  expect(screen.getByRole('combobox', { name: 'Teléfono' })).toHaveValue('Cel');
  expect(optionTexts('Producto')).toEqual(['Sin asignar', 'Item', 'Monto']);
});

it('no ofrece un encabezado ya usado por otro campo', async () => {
  setup();
  expect(optionTexts('Producto')).not.toContain('Cliente');
  expect(optionTexts('Producto')).not.toContain('Cel');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Producto' }), 'Item');
  expect(optionTexts('Total')).not.toContain('Item');
});

it('agrupa los campos en Cliente, Producto, Financiero y Entrega', () => {
  setup();
  const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(names).toEqual(['Relaciona tus columnas', 'Cliente', 'Producto', 'Financiero', 'Entrega', 'Vista previa']);
});

it('deshabilita Continuar y cuenta lo que falta por grupo', async () => {
  const onSave = jest.fn();
  setup(onSave);
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  expect(screen.getByText(/Faltan 2 campos obligatorios: Producto \(1\), Financiero \(1\)/)).toBeInTheDocument();

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Producto' }), 'Item');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Total' }), 'Monto');
  const next = screen.getByRole('button', { name: 'Continuar' });
  // "Monto" no existe en Febrero: se indica la pestaña y sigue bloqueado.
  expect(screen.getByRole('alert')).toHaveTextContent('"Monto" (Total) no existe en la pestaña "Febrero"');
  expect(next).toBeDisabled();
});

it('guarda el mapeo cuando todo está completo', async () => {
  const onSave = jest.fn();
  render(
    <StepMap
      preview={{ ...preview, tabs: [preview.tabs[0]] }}
      storeId="s1"
      tabIds={[1]}
      loading={false}
      onSave={onSave}
    />,
  );
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Producto' }), 'Item');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Total' }), 'Monto');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(onSave).toHaveBeenCalledWith({
    storeId: 's1',
    tabIds: [1],
    headerMapping: { customer_name: 'Cliente', phone: 'Cel', product_name: 'Item', total_amount: 'Monto' },
  });
});

it('muestra filas de muestra con el mapeo aplicado', () => {
  setup();
  const region = screen.getByRole('region', { name: 'Vista previa' });
  expect(within(region).getByText('Ana')).toBeInTheDocument();
  expect(within(region).getByText('999')).toBeInTheDocument();
  expect(within(region).getByText('Zoe')).toBeInTheDocument();
});
