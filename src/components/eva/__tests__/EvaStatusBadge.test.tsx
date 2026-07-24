/**
 * Tests: EvaStatusBadge
 *
 * Comportamiento verificado:
 * 1. Retorna null (nada en el DOM) cuando no se pasan props.
 * 2. Retorna null cuando evaStatus es null o undefined explícito.
 * 3. Muestra la etiqueta mapeada correctamente para los 13 estados crudos de EVA.
 * 4. Los 4 grupos de color se aplican correctamente:
 *    ENTREGADO → verde (positivo), CANCELADO/DEVUELTO → rojo (negativo),
 *    EN RUTA (y el resto de progreso) → azul,
 *    AUSENTE/NO ENTREGADO (y el resto de sinAvance) → ámbar.
 * 5. Un status desconocido (no está en el mapa) muestra el string crudo y cae
 *    en el grupo "progreso" (azul) por defecto.
 * 6. El title del span incluye "Sync:" y la fecha formateada cuando hay evaSyncedAt.
 * 7. El title es "Enviado a EVA" cuando hay status pero no evaSyncedAt.
 *
 * date-fns está mockeado para fijar la salida del formato y evitar dependencia de locale.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import EvaStatusBadge from '../EvaStatusBadge';

// Mock de date-fns para controlar la salida de format
jest.mock('date-fns', () => ({
  format: jest.fn(() => '01/01/26 12:00'),
}));

jest.mock('date-fns/locale', () => ({
  es: {},
}));

describe('EvaStatusBadge', () => {

  // ── 1. Sin datos — retorna null ───────────────────────────────────────────

  describe('sin datos EVA', () => {
    it('no renderiza nada cuando no se pasan props', () => {
      const { container } = render(<EvaStatusBadge />);
      expect(container).toBeEmptyDOMElement();
    });

    it('no renderiza nada cuando evaStatus es null', () => {
      const { container } = render(
        <EvaStatusBadge evaStatus={null} evaSyncedAt={null} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('no renderiza nada cuando evaStatus es undefined', () => {
      const { container } = render(
        <EvaStatusBadge evaStatus={undefined} evaSyncedAt="2026-01-01T12:00:00.000Z" />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ── 2. Etiquetas mapeadas para los 13 estados conocidos ───────────────────

  describe('etiquetas mapeadas para los 13 estados conocidos', () => {
    const cases: [string, string][] = [
      ['ENTREGADO', 'Entregado'],
      ['NO ENTREGADO', 'No entregado'],
      ['CANCELADO', 'Cancelado'],
      ['DEVUELTO', 'Devuelto'],
      ['REGISTRADO', 'Registrado'],
      ['EN ALMACEN', 'En almacén'],
      ['ASIGNADO MOTORIZADO', 'Asignado motorizado'],
      ['EN RUTA', 'En ruta'],
      ['PUNTO VISITADO', 'Punto visitado'],
      ['AUSENTE', 'Ausente'],
      ['REPROGRAMAR', 'Reprogramar'],
      ['INCIDENCIA', 'Incidencia'],
      ['RECOJO EN RUTA', 'Recojo en ruta'],
    ];

    test.each(cases)(
      'status "%s" muestra etiqueta "%s"',
      (status, label) => {
        render(<EvaStatusBadge evaStatus={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      },
    );
  });

  // ── 3. Agrupación de color por estado representativo ──────────────────────

  describe('agrupación de color (4 grupos)', () => {
    it('ENTREGADO usa clases verdes (grupo positivo)', () => {
      render(<EvaStatusBadge evaStatus="ENTREGADO" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-green-100');
      expect(badge.className).toContain('text-green-700');
    });

    it('NO ENTREGADO usa clases ámbar (grupo sinAvance)', () => {
      render(<EvaStatusBadge evaStatus="NO ENTREGADO" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-amber-100');
      expect(badge.className).toContain('text-amber-700');
    });

    it('CANCELADO usa clases rojas (grupo negativo)', () => {
      render(<EvaStatusBadge evaStatus="CANCELADO" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-red-100');
    });

    it('DEVUELTO usa clases rojas (grupo negativo)', () => {
      render(<EvaStatusBadge evaStatus="DEVUELTO" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-red-100');
    });

    it('EN RUTA usa clases azules (grupo progreso)', () => {
      render(<EvaStatusBadge evaStatus="EN RUTA" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-blue-100');
      expect(badge.className).toContain('text-blue-700');
    });

    it('AUSENTE usa clases ámbar (grupo sinAvance)', () => {
      render(<EvaStatusBadge evaStatus="AUSENTE" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-amber-100');
      expect(badge.className).toContain('text-amber-700');
    });
  });

  // ── 4. Valor crudo desconocido ────────────────────────────────────────────

  describe('valor crudo cuando el status no está en el mapa', () => {
    it('muestra el string exacto del status desconocido', () => {
      render(<EvaStatusBadge evaStatus="UNKNOWN_STATUS" />);
      expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
    });

    it('cae en el grupo "progreso" (azul) por defecto para un status desconocido', () => {
      render(<EvaStatusBadge evaStatus="ESTADO_INVENTADO" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge.className).toContain('bg-blue-100');
    });
  });

  // ── 5. Title / tooltip con fecha de sync ─────────────────────────────────

  describe('title del badge', () => {
    it('el title incluye "Sync:" cuando hay evaSyncedAt', () => {
      render(
        <EvaStatusBadge evaStatus="EN RUTA" evaSyncedAt="2026-01-01T12:00:00.000Z" />,
      );
      const badge = screen.getByTitle(/sync:/i);
      expect(badge).toBeInTheDocument();
    });

    it('el title incluye la fecha formateada retornada por date-fns', () => {
      render(
        <EvaStatusBadge evaStatus="ENTREGADO" evaSyncedAt="2026-01-01T12:00:00.000Z" />,
      );
      // El mock de date-fns/format devuelve '01/01/26 12:00'
      expect(screen.getByTitle('Sync: 01/01/26 12:00')).toBeInTheDocument();
    });

    it('el title es "Enviado a EVA" cuando hay status pero no evaSyncedAt', () => {
      render(<EvaStatusBadge evaStatus="REGISTRADO" />);
      expect(screen.getByTitle('Enviado a EVA')).toBeInTheDocument();
    });
  });

  // ── 6. Estructura del badge ───────────────────────────────────────────────

  describe('estructura del elemento', () => {
    it('renderiza un <span> cuando hay datos', () => {
      const { container } = render(<EvaStatusBadge evaStatus="REGISTRADO" />);
      expect(container.querySelector('span')).toBeInTheDocument();
    });

    it('el badge contiene el label dentro del span externo', () => {
      render(<EvaStatusBadge evaStatus="EN ALMACEN" />);
      const badge = screen.getByTitle('Enviado a EVA');
      expect(badge).toHaveTextContent('En almacén');
    });
  });
});
