export type CategoriaGasto =
  | 'PLANILLA'
  | 'HERRAMIENTAS'
  | 'PUBLICIDAD'
  | 'COURIER_PROPIO'
  | 'OTRO';

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
}

export interface IPnL {
  ventasBrutas: number;
  cogs: number;
  utilidadBruta: number;
  margenBruto: number;
  gastosMarketing: number;
  gastosPersonal: number;
  gastosHerramientas: number;
  gastosCourierPropio: number;
  gastosOtros: number;
  feesMarketplace: number;
  courierIntegrado: number;
  mermaUnidades: number;
  mermaCosto: number;
  totalGastosOperativos: number;
  utilidadOperativa: number;
  margenOperativo: number;
  comisionPowip: number;
  igvEstimado: number;
  utilidadNeta: number;
  margenNeto: number;
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
  createdBy?: string;
}

export interface ICanalVenta {
  nombre: string;
  ventas: number;
  unidades: number;
  fee: number;
  neto: number;
  porcentaje: number;
}

export interface IMargenProducto {
  id: string;
  nombre: string;
  sku: string;
  precioVenta: number;
  precioCosto: number;
  margen: number;
  margenPct: number;
  unidadesVendidas: number;
}
