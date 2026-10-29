/** Stock export regressions: full scope, current filter, loading, all rows, gateway errors, tabs and pagination. */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchBusinessInventoryItems } from '@/services/businessInventoryItemsService';
import type { BusinessInventoryItem } from '@/services/businessInventoryItemsService';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import AlmacenPage from '../page';
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ auth: { accessToken: 'fake-token', user: { id: 'user-1' }, company: { id: 'company-1', stores: [{id:'store-1', name:'Principal'}] } } }) }));
jest.mock('@/contexts/BusinessScopeContext', () => ({ useBusinessScope: () => ({scope:'business',storeIds:['store-1'],canFetch:true}) }));
jest.mock('@/hooks/useBusinessInventories', () => ({useBusinessInventories: () => ({inventories:[{id:'inv-1',name:'Almacén Principal',storeId:'store-1'}],isSuccess:true,isPending:false,refetch:jest.fn()})}));
jest.mock('@/services/businessInventoryItemsService', () => ({ ...jest.requireActual('@/services/businessInventoryItemsService'), fetchBusinessInventoryItems: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success:jest.fn(),error:jest.fn(),warning:jest.fn() } }));
jest.mock('next/navigation', () => ({ useRouter: () => ({push:jest.fn(),replace:jest.fn()}),usePathname:()=>'/inventario' }));
jest.mock('exceljs', () => {
  const addRowCalls: unknown[] = [];

  class MockRow {
    font?: unknown;
    alignment?: unknown;
    fill?: unknown;
  }

  class MockWorksheet {
    columns: unknown[] = [];
    private headerRow = new MockRow();

    addRow(data: unknown) {
      addRowCalls.push(data);
      return new MockRow();
    }

    getRow(_rowNumber: number) {
      return this.headerRow;
    }
  }

  class MockWorkbook {
    xlsx = {
      writeBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    addWorksheet(_name: string) {
      return new MockWorksheet();
    }
  }

  return {
    Workbook: MockWorkbook,
    __getAddRowCalls: () => addRowCalls,
    __resetAddRowCalls: () => {
      addRowCalls.length = 0;
    },
  };
});


const fetch = jest.mocked(fetchBusinessInventoryItems);
const mockToast = toast as jest.Mocked<typeof toast>;
const mockExcelJS = ExcelJS as unknown as { __getAddRowCalls: () => Array<Record<string, unknown>>; __resetAddRowCalls: () => void };
const makeItem = (id: string, name: string): BusinessInventoryItem => ({ inventoryItemId:id,productId:'product',variantId:`variant-${id}`,productName:name,sku:`SKU-${id}`,price:100,priceVta:100,availableStock:10,physicalStock:12,reservedStock:2, inventoryId:'inv-1', inventoryName:'Almacén Principal',storeId:'store-1',storeName:'Principal' });
const DEFAULT_ITEMS = [makeItem('item-1','Producto Uno'),makeItem('item-2','Producto Dos')];
function renderPage() { const client = new QueryClient({defaultOptions:{queries:{retry:false}}}); return render(<QueryClientProvider client={client}><AlmacenPage /></QueryClientProvider>); }
async function loaded() { await screen.findByText('Producto Uno'); }
beforeAll(() => { window.URL.createObjectURL = jest.fn(()=>'blob:mock'); window.URL.revokeObjectURL=jest.fn(); jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{}); });
beforeEach(() => { jest.clearAllMocks(); fetch.mockReset(); fetch.mockResolvedValue(DEFAULT_ITEMS); mockExcelJS.__resetAddRowCalls(); });
it('exports a fresh full physical scope with authenticated company context', async () => {
 renderPage(); await loaded(); const user=userEvent.setup(); await user.click(screen.getByRole('button',{name:/exportar en excel/i}));
 await waitFor(()=>expect(mockToast.success).toHaveBeenCalledWith('Exportados 2 producto(s)'));
 expect(fetch).toHaveBeenCalledTimes(2); expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({companyId:'company-1',accessToken:'fake-token',inventories:[{id:'inv-1',name:'Almacén Principal',storeId:'store-1'}]}));
 expect(mockExcelJS.__getAddRowCalls()[0]).toMatchObject({store:'Principal',inventory:'Almacén Principal'});
});
it('exports only the current search match from the full scope', async () => {
 renderPage(); await loaded(); const user=userEvent.setup(); await user.type(screen.getByPlaceholderText(/buscar por sku/i),'Uno'); await user.click(screen.getByRole('button',{name:/exportar en excel/i}));
 await waitFor(()=>expect(mockToast.success).toHaveBeenCalledWith('Exportados 1 producto(s)')); expect(mockExcelJS.__getAddRowCalls()).toEqual([expect.objectContaining({name:'Producto Uno'})]);
});
it('disables the button and restores it while export is pending', async () => {
 let resolve!: (rows: BusinessInventoryItem[])=>void;
 fetch.mockResolvedValueOnce(DEFAULT_ITEMS).mockImplementationOnce(()=>new Promise((done)=>{resolve=done;}));
 renderPage(); await loaded(); const user=userEvent.setup(); await user.click(screen.getByRole('button',{name:/exportar en excel/i}));
 expect(await screen.findByRole('button',{name:/exportando/i})).toBeDisabled(); resolve(DEFAULT_ITEMS);
 await waitFor(()=>expect(screen.getByRole('button',{name:/exportar en excel/i})).not.toBeDisabled());
});
it('exports all 25 rows while the table displays only the first ten', async () => {
 const rows=Array.from({length:25},(_,index)=>makeItem(`row-${index}`,`Producto Completo ${index}`)); fetch.mockResolvedValue(rows);
 renderPage(); await screen.findByText('Producto Completo 0'); expect(screen.queryByText('Producto Completo 10')).not.toBeInTheDocument();
 const user=userEvent.setup(); await user.click(screen.getByRole('button',{name:/exportar en excel/i})); await waitFor(()=>expect(mockExcelJS.__getAddRowCalls()).toHaveLength(25));
 expect(mockToast.success).toHaveBeenCalledWith('Exportados 25 producto(s)');
});
it.each([
 [{isAxiosError:true,response:{status:504},message:'504'},'La exportación tardó demasiado. Intente nuevamente o aplique un filtro más específico.'],
 [{isAxiosError:true,code:'ECONNABORTED',message:'timeout'},'La exportación tardó demasiado. Intente nuevamente o aplique un filtro más específico.'],
 [new Error('Network Error'),'No se pudo exportar el inventario. Intente nuevamente.'],
])('reports export failure without losing the loaded stock rows', async (error,message) => {
 fetch.mockResolvedValueOnce(DEFAULT_ITEMS).mockRejectedValueOnce(error); renderPage(); await loaded(); const user=userEvent.setup(); await user.click(screen.getByRole('button',{name:/exportar en excel/i}));
 await waitFor(()=>expect(mockToast.error).toHaveBeenCalledWith(message)); expect(screen.getByText('Producto Uno')).toBeInTheDocument(); expect(screen.getByRole('button',{name:/exportar en excel/i})).not.toBeDisabled();
});
it('keeps Stock, Movement History and Reconciliation tabs available', async () => {
 renderPage(); await loaded(); for(const name of [/stock actual/i,/historial de movimientos/i,/reconciliación/i]) expect(screen.getByRole('tab',{name})).toBeInTheDocument();
});
it('paginates the complete union without repeating fetches or exporting', async () => {
 fetch.mockResolvedValue(Array.from({length:12},(_,index)=>makeItem(`row-${index}`,`Producto Página ${index}`))); renderPage(); await screen.findByText('Producto Página 0');
 const user=userEvent.setup(); await user.click(screen.getByRole('button',{name:/siguiente/i})); expect(await screen.findByText('Producto Página 10')).toBeInTheDocument(); expect(screen.queryByText('Producto Página 0')).not.toBeInTheDocument(); expect(fetch).toHaveBeenCalledTimes(1); expect(mockExcelJS.__getAddRowCalls()).toHaveLength(0);
});
