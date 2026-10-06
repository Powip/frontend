/**
 * Tests: ShopifyCancelledBadge (FEAT-21) — marca los pedidos que se
 * cancelaron en Shopify después de importarse. Solo informa: Powip no anula
 * el pedido automáticamente.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ShopifyCancelledBadge } from '../ShopifyCancelledBadge';

describe('ShopifyCancelledBadge', () => {
  it('no renderiza nada sin cancelledAt', () => {
    const { container } = render(<ShopifyCancelledBadge cancelledAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra "Cancelado en Shopify" con el motivo traducido en el title', () => {
    render(<ShopifyCancelledBadge cancelledAt="2026-10-05T15:00:00Z" reason="customer" />);
    const badge = screen.getByText('Cancelado en Shopify');
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toContain('motivo: cliente');
  });

  it('motivo desconocido se muestra tal cual y sin motivo no agrega el sufijo', () => {
    const { rerender } = render(<ShopifyCancelledBadge cancelledAt="2026-10-05T15:00:00Z" reason="raro" />);
    expect(screen.getByText('Cancelado en Shopify').getAttribute('title')).toContain('motivo: raro');
    rerender(<ShopifyCancelledBadge cancelledAt="2026-10-05T15:00:00Z" />);
    expect(screen.getByText('Cancelado en Shopify').getAttribute('title')).not.toContain('motivo');
  });
});
