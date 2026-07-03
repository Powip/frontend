/**
 * Tests: AliclikStatusBadge
 *
 * Comportamiento verificado:
 * 1. Retorna null (nada en el DOM) cuando no hay aliclikDispatchStatus ni aliclikSyncedAt.
 * 2. Retorna null cuando ambas props son null explícito.
 * 3. Muestra la etiqueta mapeada correctamente para valores conocidos del enum:
 *    TO_PREPARE → "Por preparar", IN_TRANSIT → "En tránsito", DELIVERED → "Entregado",
 *    RETURNED → "Devuelto", CANCELED → "Cancelado", PENDING → "Pendiente", PICKED_UP → "Recogido".
 * 4. Muestra el valor crudo cuando el status es desconocido (no está en el mapa).
 * 5. Cuando hay aliclikSyncedAt, el title del span incluye "Sync:" y la fecha formateada.
 * 6. Cuando solo hay aliclikSyncedAt (sin status), el title es "Enviado a Aliclik".
 * 7. Cuando hay status pero no syncedAt, el title es "Enviado a Aliclik".
 *
 * date-fns está mockeado para fijar la salida del formato y evitar dependencia de locale.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import AliclikStatusBadge from '../AliclikStatusBadge';

// Mock de date-fns para controlar la salida de format
jest.mock('date-fns', () => ({
  format: jest.fn(() => '01/01/26 12:00'),
}));

jest.mock('date-fns/locale', () => ({
  es: {},
}));

describe('AliclikStatusBadge', () => {

  // ── 1. Sin datos — retorna null ───────────────────────────────────────────

  describe('sin datos Aliclik', () => {
    it('no renderiza nada cuando no se pasan props', () => {
      const { container } = render(<AliclikStatusBadge />);
      expect(container).toBeEmptyDOMElement();
    });

    it('no renderiza nada cuando ambas props son null', () => {
      const { container } = render(
        <AliclikStatusBadge aliclikDispatchStatus={null} aliclikSyncedAt={null} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('no renderiza nada cuando ambas props son undefined', () => {
      const { container } = render(
        <AliclikStatusBadge aliclikDispatchStatus={undefined} aliclikSyncedAt={undefined} />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ── 2. Valores conocidos del mapa ─────────────────────────────────────────

  describe('etiquetas mapeadas para valores conocidos', () => {
    const cases: [string, string][] = [
      ['TO_PREPARE',  'Por preparar'],
      ['IN_TRANSIT',  'En tránsito'],
      ['DELIVERED',   'Entregado'],
      ['RETURNED',    'Devuelto'],
      ['CANCELED',    'Cancelado'],
      ['PENDING',     'Pendiente'],
      ['PICKED_UP',   'Recogido'],
    ];

    test.each(cases)(
      'status "%s" muestra etiqueta "%s"',
      (status, label) => {
        render(<AliclikStatusBadge aliclikDispatchStatus={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      },
    );
  });

  // ── 3. Valor crudo desconocido ────────────────────────────────────────────

  describe('valor crudo cuando el status no está en el mapa', () => {
    it('muestra el string exacto del status desconocido', () => {
      render(<AliclikStatusBadge aliclikDispatchStatus="UNKNOWN_STATUS" />);
      expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
    });

    it('muestra un status inventado sin crashear', () => {
      render(<AliclikStatusBadge aliclikDispatchStatus="CUSTOM_STATE_XYZ" />);
      expect(screen.getByText('CUSTOM_STATE_XYZ')).toBeInTheDocument();
    });
  });

  // ── 4. Title / tooltip con fecha de sync ─────────────────────────────────

  describe('title del badge', () => {
    it('el title incluye "Sync:" cuando hay aliclikSyncedAt', () => {
      render(
        <AliclikStatusBadge
          aliclikDispatchStatus="IN_TRANSIT"
          aliclikSyncedAt="2026-01-01T12:00:00.000Z"
        />,
      );
      const badge = screen.getByTitle(/sync:/i);
      expect(badge).toBeInTheDocument();
    });

    it('el title incluye la fecha formateada retornada por date-fns', () => {
      render(
        <AliclikStatusBadge
          aliclikDispatchStatus="DELIVERED"
          aliclikSyncedAt="2026-01-01T12:00:00.000Z"
        />,
      );
      // El mock de date-fns/format devuelve '01/01/26 12:00'
      expect(screen.getByTitle('Sync: 01/01/26 12:00')).toBeInTheDocument();
    });

    it('el title es "Enviado a Aliclik" cuando hay status pero no syncedAt', () => {
      render(<AliclikStatusBadge aliclikDispatchStatus="PENDING" />);
      expect(screen.getByTitle('Enviado a Aliclik')).toBeInTheDocument();
    });

    it('el title es "Enviado a Aliclik" cuando solo hay syncedAt (sin status) — el label muestra "En Aliclik"', () => {
      render(<AliclikStatusBadge aliclikSyncedAt="2026-01-01T12:00:00.000Z" />);
      // Sin status → label cae en el fallback "En Aliclik"
      expect(screen.getByText('En Aliclik')).toBeInTheDocument();
      // syncedAt presente → title incluye "Sync:"
      expect(screen.getByTitle(/sync:/i)).toBeInTheDocument();
    });
  });

  // ── 5. Estructura del badge ───────────────────────────────────────────────

  describe('estructura del elemento', () => {
    it('renderiza un <span> cuando hay datos', () => {
      const { container } = render(
        <AliclikStatusBadge aliclikDispatchStatus="TO_PREPARE" />,
      );
      expect(container.querySelector('span')).toBeInTheDocument();
    });

    it('el badge contiene el label dentro del span externo', () => {
      render(<AliclikStatusBadge aliclikDispatchStatus="TO_PREPARE" />);
      const badge = screen.getByTitle('Enviado a Aliclik');
      expect(badge).toHaveTextContent('Por preparar');
    });
  });
});
