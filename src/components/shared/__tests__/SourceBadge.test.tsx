/**
 * Tests: SourceBadge (components/shared/SourceBadge.tsx)
 *
 * Comportamiento verificado:
 * - source="shopify" (y variantes de mayúsculas, normalizado con
 *   `.toLowerCase()`) renderiza el pill "Shopify".
 * - source="google_sheets" renderiza el pill "Google Sheets".
 * - source="yavendio" (y variantes de mayúsculas) renderiza el pill
 *   "Yavendio" — fix FEAT-13 Fase 3a (antes caía al fallback "Powip").
 * - Cualquier otro valor, incluidos null/undefined y fuentes desconocidas,
 *   cae al pill de fallback "Powip".
 *
 * Sin mocks: SourceBadge no depende de services, contextos ni HTTP.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SourceBadge } from '../SourceBadge';

describe('SourceBadge', () => {
  describe('source="shopify"', () => {
    it('muestra el pill "Shopify" con su title descriptivo', () => {
      render(<SourceBadge source="shopify" />);
      expect(screen.getByText('Shopify')).toBeInTheDocument();
      expect(screen.getByTitle('Pedido importado desde Shopify')).toBeInTheDocument();
    });

    it('reconoce el valor en mayúsculas ("SHOPIFY")', () => {
      render(<SourceBadge source="SHOPIFY" />);
      expect(screen.getByText('Shopify')).toBeInTheDocument();
    });
  });

  describe('source="google_sheets"', () => {
    it('muestra el pill "Google Sheets" con su title descriptivo', () => {
      render(<SourceBadge source="google_sheets" />);
      expect(screen.getByText('Google Sheets')).toBeInTheDocument();
      expect(screen.getByTitle('Pedido importado desde Google Sheets')).toBeInTheDocument();
    });

    it('reconoce el valor en mayúsculas ("GOOGLE_SHEETS")', () => {
      render(<SourceBadge source="GOOGLE_SHEETS" />);
      expect(screen.getByText('Google Sheets')).toBeInTheDocument();
    });
  });

  describe('source="yavendio" (fix FEAT-13 Fase 3a)', () => {
    it('muestra el pill "Yavendio" con su title descriptivo', () => {
      render(<SourceBadge source="yavendio" />);
      expect(screen.getByText('Yavendio')).toBeInTheDocument();
      expect(screen.getByTitle('Pedido importado desde Yavendio')).toBeInTheDocument();
    });

    it('reconoce el valor con mayúsculas mixtas ("YaVendio")', () => {
      render(<SourceBadge source="YaVendio" />);
      expect(screen.getByText('Yavendio')).toBeInTheDocument();
    });

    it('reconoce el valor totalmente en mayúsculas ("YAVENDIO")', () => {
      render(<SourceBadge source="YAVENDIO" />);
      expect(screen.getByText('Yavendio')).toBeInTheDocument();
    });

    it('ya NO cae en el fallback genérico "Powip"', () => {
      render(<SourceBadge source="yavendio" />);
      expect(screen.queryByText('Powip')).not.toBeInTheDocument();
    });
  });

  describe('fallback "Powip"', () => {
    it('cae al fallback cuando source es null', () => {
      render(<SourceBadge source={null} />);
      expect(screen.getByText('Powip')).toBeInTheDocument();
      expect(screen.getByTitle('Pedido creado manualmente en Powip')).toBeInTheDocument();
    });

    it('cae al fallback cuando source es undefined (venta manual)', () => {
      render(<SourceBadge />);
      expect(screen.getByText('Powip')).toBeInTheDocument();
    });

    it('cae al fallback para una fuente externa desconocida', () => {
      render(<SourceBadge source="mercadolibre" />);
      expect(screen.getByText('Powip')).toBeInTheDocument();
    });
  });
});
