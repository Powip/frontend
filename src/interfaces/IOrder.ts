export interface IOrder {
  id: string;
  dateVta: string;
  dateEntrega: string;
  status: string;
  tag?: string;
  estadoPago: string;
  telefono: string;
  cliente: string;
  vendedor: string;
  courier: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  entrega?: string;
  datosEntrega?: string;
  contactoAdicional?: string;
  telefonoAdicional?: string;
  canalVenta?: string;
  impTotal?: number;
  impPendiente?: number;
  claveRecojo?: string;
  trakking?: string;
  agente?: string;
}
