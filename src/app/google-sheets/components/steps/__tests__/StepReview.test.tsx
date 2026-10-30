import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepReview } from '../StepReview';
import type { ReviewResult } from '../../../types';

const review: ReviewResult = {
  dataRows: 12,
  orders: 10,
  valid: 8,
  withProblems: 2,
  overLimit: false,
  limit: 100,
  problems: [
    { orderRef: 'V-7', rowNumbers: [12, 13], message: 'Falta el teléfono' },
    { orderRef: '(pestaña)', rowNumbers: [], message: 'No se encontró el encabezado "Monto"' },
  ],
};

it('muestra válidas, con problemas, filas y pestaña, y confirma', async () => {
  const onActivate = jest.fn();
  render(<StepReview review={review} loading={false} onActivate={onActivate} />);
  expect(screen.getByText('Pedidos válidos').nextSibling).toHaveTextContent('8');
  expect(screen.getByText('Pedidos con problemas').nextSibling).toHaveTextContent('2');
  expect(screen.getByText(/Filas 12, 13 · Pedido V-7/)).toBeInTheDocument();
  expect(screen.getByText('Problema de la pestaña')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Confirmar y activar' }));
  expect(onActivate).toHaveBeenCalledWith(false);
});

it('con overLimit exige el reconocimiento y menciona total y límite', async () => {
  const onActivate = jest.fn();
  render(
    <StepReview
      review={{ ...review, overLimit: true, dataRows: 450, problems: [] }}
      loading={false}
      onActivate={onActivate}
    />,
  );
  expect(screen.getByText(/450 filas/)).toHaveTextContent('límite para cargar de una vez es 100');
  const confirm = screen.getByRole('button', { name: 'Confirmar y activar' });
  expect(confirm).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  expect(confirm).toBeEnabled();
  await userEvent.click(confirm);
  expect(onActivate).toHaveBeenCalledWith(true);
});
