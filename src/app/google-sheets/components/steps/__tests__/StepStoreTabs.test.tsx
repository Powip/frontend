import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepStoreTabs } from '../StepStoreTabs';

const tabs = [
  { id: 10, name: 'Enero' },
  { id: 11, name: 'Febrero' },
];
const base = { tabs, loading: false, onContinue: jest.fn() };

it('con una sola tienda viene preseleccionada', () => {
  render(<StepStoreTabs {...base} stores={[{ id: 's1', name: 'Mi tienda' }]} />);
  expect(screen.getByLabelText('Tienda')).toHaveValue('s1');
});

it('no avanza sin al menos una pestaña y luego envía tienda y pestañas', async () => {
  const onContinue = jest.fn();
  render(<StepStoreTabs {...base} onContinue={onContinue} stores={[{ id: 's1', name: 'Mi tienda' }]} />);
  const next = screen.getByRole('button', { name: 'Continuar' });
  expect(next).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Febrero' }));
  expect(next).toBeEnabled();
  await userEvent.click(next);
  expect(onContinue).toHaveBeenCalledWith('s1', [11]);
});

it('con varias tiendas exige elegir una', async () => {
  render(
    <StepStoreTabs
      {...base}
      stores={[
        { id: 's1', name: 'Uno' },
        { id: 's2', name: 'Dos' },
      ]}
    />,
  );
  await userEvent.click(screen.getByRole('checkbox', { name: 'Enero' }));
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText('Tienda'), 's2');
  expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
});
