"use client";
import { FormEvent, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import Header from "../ui/header";
import Container from "../ui/container";
import FormContainer from "../ui/form-container";
import FormGrid from "../ui/form-grid";
import Label from "../ui/label";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

import { getCategories } from "../../services/categoryService";
import { Category, Subcategory } from "../../interfaces/ICategory";

import { getProvidersByCompany } from "../../services/providerService";
import { getBrandsBySupplier } from "../../services/brandService";
import { Provider, Brand } from "../../interfaces/IProvider";

import { getAttributesBySubcategory } from "../../services/attributeService";
import { groupAttributesByType } from "../../utils/groupAttributes";
import { Attribute, SelectedAttribute } from "../../interfaces/IAttribute";

import { uploadImage } from "../../services/uploadService";

import { IProductRequest } from "../../interfaces/IProduct";
import { createProduct } from "../..//services/productService";
import { createProductVariant } from "../..//services/productVariantService";

const FichaProducto = () => {
  const router = useRouter();
  const companyId = "5d5b824c-2b81-4b17-960f-855bfc7806e2";

  /* Producto Inicial */
  const [product, setProduct] = useState({
    name: "",
    observations: "",
    priceCpra: "",
    priceVta: "",
    sku: "",
    categoryId: "",
    subcategoryId: "",
    companyId: "5d5b824c-2b81-4b17-960f-855bfc7806e2",
    supplierId: "",
    brandId: "",
    status: true,
    images: [] as string[],
  });

  /* Categorias - Subcategorías */
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  useEffect(() => {
    getCategories()
      .then((data) => {
        //console.log("CATEGORÍAS DEL SERVICIO:", data);
        setCategories(data);
      })
      .catch((error) => console.error("Error cargando categorías", error));
  }, []);

  // Cuando cambie la categoría, actualizamos las subcategorías disponibles
  const handleCategoryChange = (categoryId: string) => {
    handleChange("categoryId", categoryId);
    const selectedCategory = categories.find((cat) => cat.id === categoryId);
    setSubcategories(selectedCategory?.subcategories || []);
    handleChange("subcategoryId", ""); // resetear la subcategoría
  };

  /* Cargar proveedores*/
  const [providers, setProviders] = useState<Provider[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const data = await getProvidersByCompany(companyId);
        setProviders(data);
      } catch (error) {
        console.error("❌ Error al obtener proveedores:", error);
        toast.error("Error al cargar proveedores");
      }
    };
    fetchProviders();
  }, [companyId]);

  /* Cargar marcas según proveedor seleccionado */
  useEffect(() => {
    if (!product.supplierId) {
      setBrands([]);
      setProduct((prev) => ({ ...prev, brandId: "" }));
      return;
    }

    const fetchBrands = async () => {
      try {
        const data = await getBrandsBySupplier(product.supplierId);
        setBrands(data);
      } catch (error) {
        console.error("❌ Error al obtener marcas:", error);
        toast.error("Error al cargar marcas del proveedor");
      }
    };
    fetchBrands();
  }, [product.supplierId]);

  /* Atributos dinámicos */
  const [attributesByType, setAttributesByType] = useState<
    Record<string, Attribute[]>
  >({});

  const [selectedAttributes, setSelectedAttributes] = useState<
    { typeId: string; attributeId: string }[]
  >([]);

  useEffect(() => {
    if (!product.subcategoryId) return;

    const fetchAttributes = async () => {
      try {
        const data = await getAttributesBySubcategory(product.subcategoryId);
        //console.log("Atributos", data);
        const grouped = groupAttributesByType(data.attributes);
        //console.log("Atributos Agrupados", grouped);
        setAttributesByType(grouped);
      } catch (error) {
        console.error("Error cargando atributos:", error);
      }
    };

    fetchAttributes();
  }, [product.subcategoryId]);

  /* handleImageUpload  */

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await uploadImage(file);
      setProduct((prev) => ({
        ...prev,
        images: [imageUrl],
      }));

      console.log("Uploaded image URL:", imageUrl);
    } catch (error) {
      console.error("Error al subir la imagen:", error);
      alert("No se pudo subir la imagen. Intenta de nuevo.");
    }
  };

  /* HandleChange  */

  const handleChange = (key: string, value: string) => {
    setProduct((prev) => ({ ...prev, [key]: value }));
  };

  /* HandleAttributeSelect  */
  const handleAttributeSelect = ({
    typeId,
    attributeId,
  }: SelectedAttribute) => {
    setSelectedAttributes((prev) => [
      ...prev.filter((attr) => attr.typeId !== typeId), // evitamos duplicados por tipo
      { typeId, attributeId },
    ]);
  };

  /* HandleSubmit */

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 1️⃣ Crear payload del producto
    const productPayload: IProductRequest = {
      name: product.name,
      description: product.observations,
      priceBase: Number(product.priceCpra),
      priceVta: Number(product.priceVta),
      sku: product.sku?.trim() || null,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      companyId: product.companyId,
      supplierId: product.supplierId,
      brandId: product.brandId,
      availability: true,
      status: product.status,
      images: product.images,
    };

    console.log("📤 Payload producto:", productPayload);

    try {
      // 2️⃣ Crear el producto
      const newProduct = await createProduct(productPayload);
      console.log("✅ Producto creado:", newProduct);

      // 3️⃣ Crear variantes
      const createdVariants = [];

      for (let i = 0; i < selectedAttributes.length; i += 2) {
        try {
          if (selectedAttributes.length === 1) {
            const [attr1] = selectedAttributes;

            const variantPayload = {
              price: Number(product.priceVta),
              productId: newProduct.id,
              attributeTypeId: attr1.typeId,
              attributeId: attr1.attributeId,
              sku: `VAR${newProduct.id.substring(0, 6)}1`,
            };

            console.log("📦 Enviando variante con 1 atributo:", variantPayload);

            const variant = await createProductVariant(variantPayload);
            createdVariants.push(variant);
          } else if (selectedAttributes.length === 2) {
            const [attr1, attr2] = selectedAttributes;

            const variantPayload = {
              price: Number(product.priceVta),
              productId: newProduct.id,
              attributeTypeId: attr1.typeId,
              attributeId: attr1.attributeId,
              attributeTypeId2: attr2.typeId,
              attributeId2: attr2.attributeId,
              sku: `VAR${newProduct.id.substring(0, 6)}2`,
            };

            console.log(
              "📦 Enviando variante con 2 atributos:",
              variantPayload
            );

            const variant = await createProductVariant(variantPayload);
            createdVariants.push(variant);
          } else {
            console.warn("⚠️ Solo soportamos 1 o 2 atributos seleccionados");
          }
        } catch (variantError) {
          console.error("❌ Error al crear variante:", variantError);
          toast.error(`Error al crear variante: ${variantError}`);
        }
      }

      console.table(createdVariants);

      toast.success("Producto creado con éxito");
      router.push("/productos");
    } catch (error) {
      console.error("❌ Error al guardar producto:", error);
      toast.error(`Error al crear producto: ${error}`);
    }
  };

  return (
    <Container>
      <form onSubmit={handleSubmit}>
        <Header className="mb-6">Ficha Producto</Header>
        <FormContainer className="mb-6">
          <FormGrid>
            {/* Producto */}
            <div>
              <Label>Producto*</Label>
              <Input
                name="name"
                value={product.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Nombre del Producto"
              />
            </div>

            {/* SKU */}
            <div>
              <Label>SKU*</Label>
              <Input
                name="sku"
                value={product.sku}
                onChange={(e) => handleChange("sku", e.target.value)}
                placeholder="SKU"
              />
            </div>

            {/* Categoria */}
            <div>
              <Label>Categoría*</Label>
              <Select
                name="categoryId"
                value={product.categoryId}
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SubCategoria */}
            <div>
              <Label>SubCategoría*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="subcategoryId"
                  value={product.subcategoryId}
                  onValueChange={(value) =>
                    handleChange("subcategoryId", value)
                  }
                  disabled={!subcategories.length}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        subcategories.length
                          ? "Seleccionar Subcategoría"
                          : "Seleccione una categoría primero"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormGrid>

          <FormGrid>
            {/* Proveedor */}
            <div>
              <Label>Proveedor*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="supplierId"
                  value={product.supplierId}
                  onValueChange={(value) => handleChange("supplierId", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((prov) => (
                      <SelectItem key={prov.id!} value={prov.id!}>
                        {prov.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Marca */}
            <div>
              <Label>Marca*</Label>
              <div className="flex items-center gap-2">
                <Select
                  name="brandId"
                  value={product.brandId}
                  onValueChange={(value) => handleChange("brandId", value)}
                  disabled={!brands.length}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        brands.length
                          ? "Seleccionar marca"
                          : "Seleccione un proveedor primero"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Precio Compra */}
            <div>
              <Label>Precio Compra*</Label>
              <Input
                name="priceCpra"
                value={product.priceCpra}
                placeholder="Precio Compra"
                onChange={(e) => handleChange("priceCpra", e.target.value)}
              />
            </div>

            {/* Precio Venta */}
            <div>
              <Label>Precio Venta*</Label>
              <Input
                name="priceVta"
                value={product.priceVta}
                onChange={(e) => handleChange("priceVta", e.target.value)}
                placeholder="Precio Venta"
              />
            </div>
          </FormGrid>
        </FormContainer>

        <FormContainer className="mb-6">
          <FormGrid>
            {/* Atributos dinámicos */}
            {Object.entries(attributesByType).map(([typeName, attrs]) => (
              <div key={typeName}>
                <Label>{typeName}*</Label>
                <div className="flex items-center gap-2">
                  <Select
                    name={typeName.toLowerCase()}
                    onValueChange={(value) => {
                      const selectedAttr = attrs.find((a) => a.id === value);
                      if (selectedAttr) {
                        handleAttributeSelect({
                          typeId: selectedAttr.attributeType.id, // 👈 tipo de atributo
                          attributeId: selectedAttr.id, // 👈 valor de atributo
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={`Seleccionar ${typeName}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {attrs.map((attr) => (
                        <SelectItem key={attr.id} value={attr.id}>
                          {attr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            {/* Imagen */}
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

              {/* Previsualización de la imagen */}
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
              name="observations"
              value={product.observations}
              onChange={(e) => handleChange("observations", e.target.value)}
              placeholder="Observaciones"
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
          <Button variant="default" type="submit">
            Guardar
          </Button>
        </div>
      </form>
    </Container>
  );
};

export default FichaProducto;
