"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/src/components/ui/modal";
import { getProductById } from "@/src/services/productService";
import { getAttributesBySubcategory } from "@/src/services/attributeService";
import { groupAttributesByType } from "@/src/utils/groupAttributes";
import { toast } from "sonner";
import Image from "next/image";
import { IProduct } from "@/src/interfaces/IProduct";
import { Attribute } from "@/src/interfaces/IAttribute";
import Label from "@/src/components/ui/label";

interface ProductViewModalProps {
  open: boolean;
  onClose: () => void;
  productId?: string;
}

export default function ProductViewModal({
  open,
  onClose,
  productId,
}: ProductViewModalProps) {
  const [product, setProduct] = useState<IProduct | null>(null);
  const [attributesByType, setAttributesByType] = useState<
    Record<string, Attribute[]>
  >({});
  const [loading, setLoading] = useState(false);

  // === Cargar producto seleccionado ===
  useEffect(() => {
    if (!productId || !open) return;

    const fetchProduct = async () => {
      setLoading(true);
      try {
        const data = await getProductById(productId);
        setProduct(data);

        // Cargar atributos dinámicos del producto
        if (data.subcategory?.id) {
          const attrData = await getAttributesBySubcategory(
            data.subcategory.id
          );
          const grouped = groupAttributesByType(attrData.attributes);
          setAttributesByType(grouped);
        } else {
          setAttributesByType({});
        }
      } catch (err) {
        console.error("Error al cargar producto:", err);
        toast.error("Error al cargar el producto");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, open]);

  if (!product) return null;

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Modal title="Detalle del Producto" open={open} onClose={onClose}>
      {loading ? (
        <p className="text-center text-gray-500">Cargando...</p>
      ) : (
        <div className="space-y-4">
          {/* === Encabezado === */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {product.name}
              </h3>
              <p className="text-sm text-gray-600">{product.description}</p>
            </div>

            {product.images?.length > 0 && (
              <div className="flex justify-center sm:justify-end">
                {isValidUrl(product.images[0]) ? (
                  // ✅ Si el dominio es seguro y permitido, usamos next/image
                  product.images[0].startsWith("https://res.cloudinary.com") ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      width={120}
                      height={120}
                      className="rounded-lg shadow-md object-contain"
                    />
                  ) : (
                    //
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      width={120}
                      height={120}
                      className="rounded-lg shadow-md object-contain opacity-80"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/placeholder-image.png";
                      }}
                    />
                  )
                ) : (
                  // 🩶 Si la URL no es válida, mostramos el placeholder directamente
                  <img
                    src="/placeholder-image.png"
                    alt="Imagen no disponible"
                    width={120}
                    height={120}
                    className="rounded-lg shadow-md object-contain opacity-80"
                  />
                )}
              </div>
            )}
          </div>

          {/* === Datos generales === */}
          <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
            <p>
              <strong>SKU:</strong> {product.sku}
            </p>
            <p>
              <strong>Precio Venta:</strong> ${product.priceVta}
            </p>
            <p>
              <strong>Categoría:</strong> {product.category?.name}
            </p>
            <p>
              <strong>Subcategoría:</strong> {product.subcategory?.name}
            </p>
            <p>
              <strong>Proveedor:</strong> {product.supplier?.name}
            </p>
            <p>
              <strong>Marca:</strong> {product.brand?.name}
            </p>
          </div>

          {/* === Atributos dinámicos === */}
          {Object.entries(attributesByType).length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-base font-semibold text-gray-800 mb-3">
                Atributos del producto
              </h4>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(attributesByType).map(([typeName, attrs]) => (
                  <div key={typeName}>
                    <Label>{typeName}</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {attrs.map((attr) => (
                        <span
                          key={attr.id}
                          className="px-3 py-1 bg-gray-100 border rounded-md text-sm text-gray-700 shadow-sm"
                        >
                          {attr.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
