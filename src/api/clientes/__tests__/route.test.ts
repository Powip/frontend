import axiosAuth from '@/lib/axiosAuth';
import { findByCompany, createClient, toggleClienteActivo } from '../route';

jest.mock('@/lib/axiosAuth', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const get = jest.mocked(axiosAuth.get);

it('propaga la falla autenticada de clientes sin convertirla en undefined', async () => {
  get.mockRejectedValueOnce(new Error('401'));
  const signal = new AbortController().signal;
  await expect(findByCompany('company', { brandId: 'brand' }, signal)).rejects.toThrow('401');
  expect(get.mock.calls[0][0]).not.toContain("undefined");
  expect(get).toHaveBeenCalledWith(expect.stringContaining('/clients/company/company'), { params: { brandId: 'brand' }, signal });
});

it('propaga fallos al crear o activar clientes para impedir mensajes falsos de éxito', async () => {
  jest.mocked(axiosAuth.post).mockRejectedValueOnce(new Error('401'));
  jest.mocked(axiosAuth.patch).mockRejectedValueOnce(new Error('401'));
  await expect(createClient({ companyId: 'company', fullName: 'Ana', phoneNumber: '999111222', clientType: 'TRADICIONAL', province: '', city: '', district: '', address: '' })).rejects.toThrow('401');
  await expect(toggleClienteActivo('client')).rejects.toThrow('401');
});
