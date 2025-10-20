export interface Subcategory {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  status?: boolean;
  categoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sku: string;
  status: boolean;
  subcategories: Subcategory[];
}
