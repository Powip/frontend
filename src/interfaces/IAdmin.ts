export type CategoriaGasto =
  | 'PLANILLA'
  | 'HERRAMIENTAS'
  | 'PUBLICIDAD'
  | 'COURIER_PROPIO'
  | 'OTRO'
  // Compra de mercadería por prenda. No es gasto operativo: no entra al P&L.
  | 'INVERSION';

export interface IGastoOperativo {
  id: string;
  company_id: string;
  categoria: CategoriaGasto;
  descripcion: string | null;
  monto: number;
  mes: number;
  anio: number;
  dateStart?: string | null;
  dateEnd?: string | null;
  prorated?: boolean;
  totalAmount?: number | null;
  source?: string;
  platform?: string | null;
  recurrence?: string | null;
  productId?: string | null;
  productName?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ICreateGastoDto {
  categoria: CategoriaGasto;
  descripcion?: string;
  monto: number;
  mes: number;
  anio: number;
  dateStart?: string;
  dateEnd?: string;
  prorated?: boolean;
  totalAmount?: number;
  source?: string;
  platform?: string;
  recurrence?: string;
  productId?: string | null;
  productName?: string | null;
}


export interface IMarketplaceConfig {
  id: string;
  companyId: string;
  channel: string;
  commissionPct: number;
  fixedCharge: number;
  shippingFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateMarketplaceConfigDto {
  channel: string;
  commissionPct: number;
  fixedCharge: number;
  shippingFee: number;
  isActive?: boolean;
}

export interface IInventoryShrinkage {
  id: string;
  companyId: string;
  inventoryItemId: string | null;
  shrinkageType: string;
  quantity: number;
  unitCost: number;
  recoveredAmount: number;
  notes: string | null;
  referenceId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ICreateShrinkageDto {
  inventoryItemId?: string;
  shrinkageType: string;
  quantity: number;
  unitCost: number;
  recoveredAmount?: number;
  notes?: string;
  referenceId?: string;
  /** Ya no se manda: la fachada de ms-products lo toma del token (FEAT-24 SEC). */
  createdBy?: string;
}


