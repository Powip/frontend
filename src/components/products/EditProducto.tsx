"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

import Container from "../ui/container";
import Header from "../ui/header";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { getProductById, updateProduct } from "@/services/productService";

import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";
import { getBrandsBySupplier } from "@/services/brandService";
import { uploadImage } from "@/services/uploadService";
import { groupAttributesByType } from "../../utils/groupAttributes";

import { Category, Subcategory } from "@/interfaces/ICategory";
import { Provider, Brand } from "@/interfaces/IProvider";
import { IProductRequest } from "@/interfaces/IProduct";
import { Attribute, SelectedAttribute } from "@/interfaces/IAttribute";
import { Label } from "../ui/label";

const EditProducto = () => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatedProductId, setValidatedProductId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Listas para selects
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  /* Atributos dinámicos */
  const [attributesByType, setAttributesByType] = useState<
    Record<string, Attribute[]>
  >({});

  // Estado del producto
  const [product, setProduct] = useState({
    name: "",
    description: "",
    priceBase: "",
    priceVta: "",
    sku: "",
    categoryId: "",
    subcategoryId: "",
    companyId,
    supplierId: "",
    brandId: "",
    status: true,
    images: [] as string[],
  });

  useEffect(() => {
    if (!id || !companyId) return;

    const fetchData = async () => {
      setValidatedProductId(null); setLoadError(null);
      try {
        const prod = await getProductById(id);
        if (prod.companyId !== companyId) throw new Error("El producto no pertenece al negocio activo.");

        const [cats, provs, brs] = await Promise.all([
          axiosAuth.get<Category[]>(`${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/categories`).then((response) => response.data),
          axiosAuth.get<Provider[]>(`${process.env.NEXT_PUBLIC_API_INVENTORY || GATEWAY.logistics}/suppliers/company/${companyId}`).then((response) => response.data),
          getBrandsBySupplier(prod.supplierId),
        ]);

        // 🟢 Buscar la categoría correspondiente al producto
        const categoryId = prod.subcategory?.category?.id || prod.category?.id || prod.categoryId || "";
        const selectedCat = cats.find((c) => c.id === categoryId);

        // 🟢 Extraer las subcategorías activas de esa categoría
        const activeSubs =
          selectedCat?.subcategories?.filter((s) => s.status) || [];

        setCategories(cats);
        setSubcategories(activeSubs);
        setBrands(brs);
        setProviders(provs);

        // 🟢 Cargar el producto con los valores actuales
        setValidatedProductId(id);
        setProduct({
          name: prod.name,
          description: prod.description || "",
          priceBase: String(prod.priceBase ?? 0),
          priceVta: String(prod.priceVta ?? 0),
          sku: prod.sku,
          categoryId,
          subcategoryId: prod.subcategory?.id || prod.subcategoryId || "", // ✅ ahora coincide con una opción válida
          companyId,
          supplierId: prod.supplierId,
          brandId: prod.brandId,
          status: prod.status,
          images: prod.images || [],
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Error al cargar producto");
        toast.error("Error al cargar producto");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, companyId]);
  // The current category list does not embed its subcategories.
  useEffect(() => {
    if (!product.categoryId) { setSubcategories([]); return; }
    const controller = new AbortController();
    axiosAuth.get<Subcategory[]>(`${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/subcategories/category/${product.categoryId}`, { signal: controller.signal })
      .then(({ data }) => {
        setSubcategories(data.filter((subcategory) => subcategory.status !== false));
      }).catch(() => { if (!controller.signal.aborted) toast.error("No se pudieron cargar las subcategorías"); });
    return () => controller.abort();
  }, [product.categoryId]);

  // === Cargar marcas cuando cambia proveedor ===
  useEffect(() => {
    if (!product.supplierId) return;
    getBrandsBySupplier(product.supplierId)
      .then(setBrands)
      .catch((err) => console.error("Error al cargar marcas", err));
  }, [product.supplierId]);

  // === Cargar atributos dinámicos según la subcategoría ===
  useEffect(() => {
    if (!product.subcategoryId) return;

    const fetchAttributes = async () => {
      try {
        const { data } = await axiosAuth.get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS || GATEWAY.products}/products/attributes-by-subcategory/${product.subcategoryId}`);
        const grouped = groupAttributesByType(data.attributes);
        setAttributesByType(grouped);
      } catch (error) {
        console.error("Error cargando atributos:", error);
      }
    };

    fetchAttributes();
  }, [product.subcategoryId]);

  const handleChange = (key: string, value: string) => {
    setProduct((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await uploadImage(file);
      setProduct((prev) => ({
        ...prev,
        images: [imageUrl],
      }));
      toast.success("Imagen subida correctamente");
    } catch (error) {
      console.error("Error al subir la imagen:", error);
      toast.error("No se pudo subir la imagen");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!companyId || validatedProductId !== id || product.companyId !== companyId) { toast.error("El producto no pertenece al negocio activo."); return; }
    const payload: IProductRequest = {
      name: product.name,
      description: product.description,
      priceBase: Number(product.priceBase),
      priceVta: Number(product.priceVta),
      sku: product.sku,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      companyId: product.companyId,
      supplierId: product.supplierId,
      brandId: product.brandId,
      availability: true,
      status: product.status,
      images: product.images,
    };

    setSaving(true);
    try {
      await updateProduct(id, payload);
      toast.success("Producto actualizado correctamente");
      router.push("/productos");
      router.refresh();
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      toast.error("Error al actualizar producto");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center mt-6">Cargando...</p>;
  if (loadError) return <div role="alert" className="p-6">{loadError}<Button onClick={() => router.push("/productos")}>Volver al catálogo</Button></div>;

  return (
    <Container>
      <form onSubmit={handleSubmit}>
        <Header className="mb-6">Editar Producto</Header>

        {/* === DATOS PRINCIPALES === */}
        <FormContainer className="mb-6">
          <FormGrid>
            <div>
              <Label>Producto*</Label>
              <Input value={product.name} disabled />
            </div>

            <div>
              <Label>SKU*</Label>
              <Input
                value={product.sku}
                onChange={(e) => handleChange("sku", e.target.value)}
              />
            </div>

            <div>
              <Label>Categoría*</Label>
              <select
                value={product.categoryId}
                disabled
                className="border rounded px-2 py-1 w-full bg-gray-100 cursor-not-allowed"
              >
                <option value="">Seleccionar categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Subcategoría*</Label>
              <select
                value={product.subcategoryId}
                disabled
                className="border rounded px-2 py-1 w-full bg-gray-100 cursor-not-allowed"
              >
                <option value="">Seleccionar subcategoría</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </FormGrid>

          <FormGrid>
            <div>
              <Label>Proveedor*</Label>
              <select
                value={product.supplierId}
                onChange={(e) => handleChange("supplierId", e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">Seleccionar proveedor</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Marca*</Label>
              <select
                value={product.brandId}
                onChange={(e) => handleChange("brandId", e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">Seleccionar marca</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {auth?.user?.role !== 'VENTAS' && (
              <div>
                <Label>Precio Compra*</Label>
                <Input
                  value={product.priceBase}
                  onChange={(e) => handleChange("priceBase", e.target.value)}
                />
              </div>
            )}

            <div>
              <Label>Precio Venta*</Label>
              <Input
                value={product.priceVta}
                onChange={(e) => handleChange("priceVta", e.target.value)}
              />
            </div>
          </FormGrid>
        </FormContainer>

        {/* === IMAGEN Y DESCRIPCIÓN === */}
        <FormContainer className="mb-6">
          {/* === ATRIBUTOS DINÁMICOS === */}
          {Object.entries(attributesByType).length > 0 && (
            <FormContainer>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Atributos del producto
              </h3>

              <FormGrid>
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
              </FormGrid>
            </FormContainer>
          )}
          <FormGrid>
            <div className="flex flex-col col-span-2">
              <Label>Imagen</Label>
              <Label
                className="flex flex-col items-center justify-center 
                            w-full h-20 px-3 py-4 
                            border-2 border-dashed border-gray-400 
                            rounded-lg cursor-pointer 
                            hover:border-gray-600 transition"
              >
                <span className="text-sm text-gray-600">Subir imagen</span>
                <input
                  type="file"
                  name="imagen"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </Label>

              {product.images.length > 0 && (
                <div className="mt-6 relative w-50 h-50">
                  <Image
                    src={product.images[0]}
                    alt="Previsualización"
                    fill
                    className="object-contain rounded-lg shadow"
                  />
                </div>
              )}
            </div>
          </FormGrid>
        </FormContainer>

        <FormContainer className="mb-6">
          <div>
            <Label>Observaciones*</Label>
            <Input
              value={product.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>
        </FormContainer>

        {/* Buttons */}
        <div className="flex justify-center gap-10 mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/productos")}
          >
            Cancelar
          </Button>
          <Button variant="default" type="submit" disabled={saving || validatedProductId !== id}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </Container>
  );
};

export default EditProducto;
