import { Attribute } from "../interfaces/IAttribute";

export function groupAttributesByType(attributes: Attribute[]) {
  return attributes.reduce((acc, attr) => {
    const typeName = attr.attributeType.name;
    if (!acc[typeName]) {
      acc[typeName] = [];
    }
    acc[typeName].push(attr);
    return acc;
  }, {} as Record<string, Attribute[]>);
}
