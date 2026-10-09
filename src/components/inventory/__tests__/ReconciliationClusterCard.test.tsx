import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReconciliationClusterCard } from '../ReconciliationClusterCard';
import type { ReconciliationTask } from '@/services/reconciliationTask.service';

function cluster(sources: ('shopify' | 'aliclik')[]): ReconciliationTask {
  return {
    id: 'task-c1',
    companyId: 'c',
    type: 'duplicate_cluster',
    status: 'pending',
    confidenceLevel: 0.85,
    dedupeKey: null,
    resolvedByUserId: null,
    resolvedAt: null,
    createdAt: '',
    updatedAt: '',
    items: sources.map((source, i) => ({
      variant_id: `v-${i}`,
      product_id: `p-${i}`,
      variant_name: i === 0 ? 'Camiseta Azul M' : 'Camiseta Azul Mediana',
      sku: `SKU-${i}`,
      company_sku: null,
      external_id: null,
      source,
      confidence: 0.9,
      is_suggested_winner: i === 0,
    })),
  };
}

describe('ReconciliationClusterCard', () => {
  it('muestra la sugerida, la confianza y el canal de cada candidata', () => {
    render(
      <ReconciliationClusterCard
        task={cluster(['shopify', 'aliclik'])}
        isProcessing={false}
        onMerge={jest.fn()}
        onReject={jest.fn()}
      />,
    );
    expect(screen.getAllByText('Camiseta Azul M').length).toBeGreaterThan(0);
    expect(screen.getByText('85% confianza')).toBeInTheDocument();
    expect(screen.getByText('Sugerida')).toBeInTheDocument();
    expect(screen.getByText('Shopify')).toBeInTheDocument();
    expect(screen.getByText('Aliclik')).toBeInTheDocument();
  });

  it('"Revisar y unificar" y "Son distintos" llaman a sus callbacks', async () => {
    const onMerge = jest.fn();
    const onReject = jest.fn();
    render(
      <ReconciliationClusterCard
        task={cluster(['shopify', 'aliclik'])}
        isProcessing={false}
        onMerge={onMerge}
        onReject={onReject}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /revisar y unificar/i }));
    await user.click(screen.getByRole('button', { name: /son distintos/i }));
    expect(onMerge).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('franja ámbar solo si todas comparten canal', () => {
    const { rerender } = render(
      <ReconciliationClusterCard
        task={cluster(['shopify', 'shopify'])}
        isProcessing={false}
        onMerge={jest.fn()}
        onReject={jest.fn()}
      />,
    );
    expect(screen.getByText(/todas están en/i)).toBeInTheDocument();
    rerender(
      <ReconciliationClusterCard
        task={cluster(['shopify', 'aliclik'])}
        isProcessing={false}
        onMerge={jest.fn()}
        onReject={jest.fn()}
      />,
    );
    expect(screen.queryByText(/todas están en/i)).not.toBeInTheDocument();
  });
});
