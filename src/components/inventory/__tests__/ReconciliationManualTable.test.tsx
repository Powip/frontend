import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReconciliationManualTable } from '../ReconciliationManualTable';
import type { ReconciliationTask } from '@/services/reconciliationTask.service';

const manual: ReconciliationTask = {
  id: 'task-m1',
  companyId: 'c',
  type: 'manual',
  status: 'pending',
  confidenceLevel: null,
  dedupeKey: null,
  resolvedByUserId: null,
  resolvedAt: null,
  createdAt: '',
  updatedAt: '',
  items: [
    {
      variant_id: null,
      product_id: null,
      variant_name: 'Línea X',
      sku: null,
      company_sku: null,
      external_id: null,
      source: 'yavendio',
      confidence: 0,
      external_order_id: 'ORD-9',
      external_line_ref: 'L-1',
    },
  ],
};

describe('ReconciliationManualTable', () => {
  it('muestra la línea con el chip de canal y Rechazar llama a onReject', async () => {
    const onReject = jest.fn();
    render(
      <ReconciliationManualTable tasks={[manual]} actionLoadingId={null} onReject={onReject} />,
    );
    expect(screen.getByText('Línea X')).toBeInTheDocument();
    expect(screen.getByText('ORD-9')).toBeInTheDocument();
    expect(screen.getByText('Yavendio')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /rechazar/i }));
    expect(onReject).toHaveBeenCalledWith(manual);
  });
});
