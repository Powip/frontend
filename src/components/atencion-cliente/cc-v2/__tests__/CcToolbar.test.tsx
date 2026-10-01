/**
 * Tests: CcToolbar — buscador y botón "Exportar Excel"
 *
 * 1. Exportar muestra la cantidad seleccionada y se deshabilita sin selección.
 * 2. Exportar no se renderiza si la pestaña no lo habilita (sin onExportar).
 * 3. El buscador propaga lo escrito y el botón X lo limpia.
 * 4. Sin onSearchChange no hay buscador (pestañas Lima/Carrito).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CcToolbar } from '../CcToolbar';

const base = {
  agenteId: '',
  canalOrigen: '',
  agentes: [],
  onAgenteChange: jest.fn(),
  onCanalChange: jest.fn(),
  onWhatsAppMasivo: jest.fn(),
  onCopiar: jest.fn(),
  canales: [],
};

describe('CcToolbar — exportar', () => {
  it('deshabilita el botón sin selección', () => {
    render(<CcToolbar {...base} selectedCount={0} onExportar={jest.fn()} />);
    expect(screen.getByRole('button', { name: /exportar excel/i })).toBeDisabled();
  });

  it('indica cuántos pedidos se exportarán y dispara onExportar', async () => {
    const onExportar = jest.fn();
    render(<CcToolbar {...base} selectedCount={3} onExportar={onExportar} />);
    const btn = screen.getByRole('button', { name: 'Exportar Excel (3)' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onExportar).toHaveBeenCalledTimes(1);
  });

  it('se deshabilita mientras exporta', () => {
    render(<CcToolbar {...base} selectedCount={3} onExportar={jest.fn()} exporting />);
    expect(screen.getByRole('button', { name: /exportando/i })).toBeDisabled();
  });

  it('no aparece si la pestaña no permite exportar', () => {
    render(<CcToolbar {...base} selectedCount={3} />);
    expect(screen.queryByRole('button', { name: /exportar excel/i })).not.toBeInTheDocument();
  });
});

describe('CcToolbar — buscador', () => {
  it('propaga lo escrito', async () => {
    const onSearchChange = jest.fn();
    render(<CcToolbar {...base} selectedCount={0} search="" onSearchChange={onSearchChange} />);
    await userEvent.type(screen.getByRole('searchbox', { name: /buscar pedidos/i }), 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('el botón X limpia la búsqueda y solo aparece con texto', async () => {
    const onSearchChange = jest.fn();
    const { rerender } = render(
      <CcToolbar {...base} selectedCount={0} search="" onSearchChange={onSearchChange} />,
    );
    expect(screen.queryByRole('button', { name: /limpiar búsqueda/i })).not.toBeInTheDocument();

    rerender(<CcToolbar {...base} selectedCount={0} search="juan" onSearchChange={onSearchChange} />);
    await userEvent.click(screen.getByRole('button', { name: /limpiar búsqueda/i }));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('no se muestra sin onSearchChange', () => {
    render(<CcToolbar {...base} selectedCount={0} />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
