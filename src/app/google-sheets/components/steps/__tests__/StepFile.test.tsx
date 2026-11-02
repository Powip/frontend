import { render, screen } from '@testing-library/react';
import { StepFile } from '../StepFile';

const original = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
afterEach(() => {
  process.env.NEXT_PUBLIC_GOOGLE_API_KEY = original;
  if (original === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  document.querySelectorAll('script[src*="apis.google.com"]').forEach((s) => s.remove());
});

const props = { loading: false, getAccessToken: jest.fn(), onSelectFile: jest.fn() };

it('muestra el aviso de no subir historial', () => {
  process.env.NEXT_PUBLIC_GOOGLE_API_KEY = 'key';
  render(<StepFile {...props} />);
  expect(
    screen.getByText('Deja en la hoja solo las ventas que quieres cargar ahora. No subas tu historial.'),
  ).toBeInTheDocument();
});

it('avisa si falta la clave de Google y no permite abrir el selector', () => {
  delete process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  render(<StepFile {...props} />);
  expect(screen.getByRole('alert')).toHaveTextContent('NEXT_PUBLIC_GOOGLE_API_KEY');
  expect(screen.getByRole('button', { name: /Seleccionar archivo/ })).toBeDisabled();
  expect(document.querySelector('script[src*="apis.google.com"]')).toBeNull();
});
