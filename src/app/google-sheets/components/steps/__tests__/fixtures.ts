import type { PreviewResponse } from '../../../types';

export const preview: PreviewResponse = {
  fields: [
    { key: 'customer_name', label: 'Nombre del cliente', group: 'customer', required: true, synonyms: [] },
    { key: 'phone', label: 'Teléfono', group: 'customer', required: true, synonyms: [] },
    { key: 'product_name', label: 'Producto', group: 'product', required: true, synonyms: [] },
    { key: 'total_amount', label: 'Total', group: 'financial', required: true, synonyms: [] },
    { key: 'delivery_date', label: 'Fecha de entrega', group: 'delivery', required: false, synonyms: [] },
  ],
  tabs: [
    {
      id: 1,
      name: 'Enero',
      rawHeaders: ['Cliente', 'Cel', 'Item', 'Monto'],
      headers: ['Cliente', 'Cel', 'Item', 'Monto'],
      sampleRows: [
        ['Ana', '999', 'Polo', '50'],
        ['Luis', '888', 'Gorra', '20'],
        ['Eva', '777', 'Zapato', '90'],
      ],
      rowCount: 3,
      suggestedMapping: { customer_name: 'Cliente', phone: 'Cel' },
    },
    {
      id: 2,
      name: 'Febrero',
      rawHeaders: ['Cliente', 'Cel', 'Item'],
      headers: ['Cliente', 'Cel', 'Item'],
      sampleRows: [['Zoe', '666', 'Medias']],
      rowCount: 1,
      suggestedMapping: {},
    },
  ],
};
