import { render, screen, within } from '@testing-library/react';
import { ReconciliationAppliedList } from '../ReconciliationAppliedList';
import type { ReconciliationTask } from '@/services/reconciliationTask.service';

function applied(overrides: Partial<ReconciliationTask>): ReconciliationTask {
  return {
    id: 't',
    companyId: 'c',
    type: 'duplicate_cluster',
    status: 'confirmed',
    confidenceLevel: 1,
    dedupeKey: null,
    resolvedByUserId: 'u',
    resolvedAt: '2026-10-09T15:00:00Z',
    createdAt: '',
    updatedAt: '',
    items: [
      { variant_id: 'a', product_id: 'pa', variant_name: 'Crema A', sku: null, company_sku: null, external_id: null, source: 'shopify', confidence: 1 },
      { variant_id: 'b', product_id: 'pb', variant_name: 'Crema B', sku: null, company_sku: null, external_id: null, source: 'shopify', confidence: 1 },
    ],
    ...overrides,
  };
}

describe('ReconciliationAppliedList', () => {
  it('una fila por tarea con tipo, productos, canal sin repetir y fecha', () => {
    render(
      <ReconciliationAppliedList
        tasks={[
          applied({ id: 't1' }),
          applied({
            id: 't2',
            type: 'provisional',
            resolvedAt: null,
            items: [
              { variant_id: 'c', product_id: 'pc', variant_name: 'Jabón', sku: null, company_sku: null, external_id: null, source: null, confidence: 0 },
            ],
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Unificación')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Crema A · Crema B')).toBeInTheDocument();
    expect(within(rows[0]).getAllByText('Shopify')).toHaveLength(1);
    expect(within(rows[0]).queryByText('-')).not.toBeInTheDocument();
    expect(within(rows[1]).getByText('Provisional resuelta')).toBeInTheDocument();
    expect(within(rows[1]).getAllByText('-')).toHaveLength(2);
  });
});
