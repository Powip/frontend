/**
 * Tests: RouteErrorFallback (components/shared/RouteErrorFallback.tsx)
 *
 * Componente nuevo del hardening de errores (FEAT-07): fallback visible y
 * reutilizable que consumen los `error.tsx` de ruta (packs-promos,
 * registrar-venta). Antes un throw durante el render de un consumidor de
 * `usePacks()` (u otro hook) desmontaba la pantalla entera sin dejar nada en
 * consola.
 *
 * Se testea COMPORTAMIENTO de usuario, no implementación:
 * 1. Muestra el título genérico "Algo salió mal" y el texto de ayuda.
 * 2. Con `section` el título se personaliza ("Algo salió mal en Packs & Promos").
 * 3. El botón "Reintentar" invoca el callback `reset` al hacer click.
 * 4. `error.digest` se muestra en pantalla sólo cuando viene definido.
 * 5. Loguea el crash con `console.error("[RouteError]", section, error)` — único
 *    rastro para diagnóstico.
 *
 * Sin mocks de services/contextos: el componente sólo depende de props y de los
 * primitivos Button/Card (sin red). `console.error` se silencia y se espía
 * porque el componente lo llama en un `useEffect` en cada montaje.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteErrorFallback } from '../RouteErrorFallback';

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

/** Error como el que pasa Next.js al Error Boundary (Error + `digest` opcional). */
const makeError = (message = 'boom', digest?: string) => {
  const err = new Error(message) as Error & { digest?: string };
  if (digest) err.digest = digest;
  return err;
};

describe('RouteErrorFallback', () => {
  it('muestra el título genérico y el texto de ayuda para reintentar', () => {
    render(<RouteErrorFallback error={makeError()} reset={jest.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Algo salió mal' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/podés reintentar/i)).toBeInTheDocument();
  });

  it('personaliza el título con la sección cuando se pasa `section`', () => {
    render(
      <RouteErrorFallback
        error={makeError()}
        reset={jest.fn()}
        section="Packs & Promos"
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: /algo salió mal en packs & promos/i,
      }),
    ).toBeInTheDocument();
  });

  it('invoca `reset` al hacer click en "Reintentar"', async () => {
    const reset = jest.fn();
    const user = userEvent.setup();
    render(<RouteErrorFallback error={makeError()} reset={reset} />);

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('muestra el código de error cuando `error.digest` viene definido', () => {
    render(
      <RouteErrorFallback
        error={makeError('boom', 'abc123digest')}
        reset={jest.fn()}
      />,
    );

    expect(screen.getByText(/abc123digest/)).toBeInTheDocument();
  });

  it('no muestra ningún código de error cuando `error.digest` no viene', () => {
    render(<RouteErrorFallback error={makeError()} reset={jest.fn()} />);

    expect(screen.queryByText(/código de error/i)).not.toBeInTheDocument();
  });

  it('deja rastro del crash en consola para diagnóstico (antes no quedaba ninguno)', () => {
    const error = makeError('render crash');

    render(
      <RouteErrorFallback
        error={error}
        reset={jest.fn()}
        section="Registrar venta"
      />,
    );

    // Comportamiento: hay un log de error que arrastra el objeto de error real.
    // No se afirma el formato exacto de los argumentos (era el único assert de
    // implementación que marcó el review).
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RouteError]'),
      expect.anything(),
      error,
    );
  });
});
