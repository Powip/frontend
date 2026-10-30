import axiosAuth from '@/lib/axiosAuth';
import { googleSheetsApi } from '../googleSheetsApi';

jest.mock('@/lib/axiosAuth', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mocked = axiosAuth as unknown as { get: jest.Mock; post: jest.Mock };

describe('googleSheetsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.get.mockResolvedValue({ data: { tabs: [], issues: [], accessToken: 't', url: 'u' } });
    mocked.post.mockResolvedValue({ data: {} });
  });

  const callAll = async () => {
    await googleSheetsApi.getConfig();
    await googleSheetsApi.getAuthUrl();
    await googleSheetsApi.getAccessToken();
    await googleSheetsApi.saveSheet('f1', 'Ventas');
    await googleSheetsApi.getTabs('f1');
    await googleSheetsApi.preview([1]);
    await googleSheetsApi.saveConfig({ storeId: 's', tabIds: [1], headerMapping: { sku: 'SKU' } });
    await googleSheetsApi.review();
    await googleSheetsApi.activate(true);
    await googleSheetsApi.syncNow();
    await googleSheetsApi.getIssues();
    await googleSheetsApi.disconnect();
  };

  it('usa axiosAuth para todas las llamadas', async () => {
    await callAll();
    expect(mocked.get).toHaveBeenCalledTimes(5);
    expect(mocked.post).toHaveBeenCalledTimes(7);
  });

  it('ninguna llamada manda companyId', async () => {
    await callAll();
    const calls = [...mocked.get.mock.calls, ...mocked.post.mock.calls];
    expect(JSON.stringify(calls)).not.toMatch(/companyId/i);
  });

  it('getIssues devuelve la lista y activate manda el reconocimiento', async () => {
    mocked.get.mockResolvedValueOnce({ data: { issues: [{ code: 'X' }] } });
    await expect(googleSheetsApi.getIssues()).resolves.toEqual([{ code: 'X' }]);
    await googleSheetsApi.activate(true);
    expect(mocked.post).toHaveBeenLastCalledWith(
      expect.stringContaining('/integrations/google/activate'),
      { acknowledgeHistory: true },
    );
  });
});
