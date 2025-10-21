export interface AttributeType {
  id: string;
  name: string;
}

export interface Attribute {
  id: string;
  name: string;
  attributeType: AttributeType;
}

export interface AttributesResponse {
  subcategory: {
    id: string;
    name: string;
  };
  attributes: Attribute[];
  total: number;
}

export interface SelectedAttribute {
  typeId: string;
  attributeId: string;
}
