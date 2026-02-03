"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
}

interface CreateProductBase {
  name: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  inventory_id: string;
  supplierId: string;
  brandId: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
  supplier: { id: string };
}

interface DefaultAttribute {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: any[];
}

interface CustomAttribute {
  id: string; // local id
  name: string;
  rawValues: string; // Valor raw para el input (ej: "S, M, L")
}

interface VariantForm {
  id?: string; // ID de la variante (solo en modo edición)
  attributes: Record<string, string>; // { Talle: "M", Color: "Negro" }
  priceBase: number;
  priceVta: number;
  stock: number;
  minStock: number;
  imageFile: File | null;
}

// ---------- util: cartesian product ----------
function generateCartesian(obj: Record<string, string[]>) {
  const entries = Object.entries(obj).filter(([_, arr]) => arr.length > 0);
  if (entries.length === 0) return [];

  const cartesian = (acc: any[], [key, values]: [string, string[]]) =>
    acc.flatMap((a) => values.map((v) => ({ ...a, [key]: v })));

  return entries.reduce(cartesian, [{}]);
}

interface ProductCreateFormProps {
  editVariantId?: string | null;
}

export default function ProductCreateForm({
  editVariantId,
}: ProductCreateFormProps) {
  const { auth, inventories } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);

  const [form, setForm] = useState<CreateProductBase>({
    name: "",
    description: "",
    categoryId: "",
    subcategoryId: "",
    inventory_id: "",
    supplierId: "",
    brandId: "",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);

  const [defaultAttributes, setDefaultAttributes] = useState<
    DefaultAttribute[]
  >([]);

  const [attributeValues, setAttributeValues] = useState<
    Record<string, string>
  >({});

  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(
    [],
  );

  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [message, setMessage] = useState("");

  // Quick create modals
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [quickBrandName, setQuickBrandName] = useState("");
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);

  // =========================
  // Cargar categorías
  // =========================
  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/categories`)
      .then((res) => setCategories(res.data))
      .catch((err) => console.error("Error al cargar categorías", err));

    // Cargar proveedores
    axios
      .get(`${process.env.NEXT_PUBLIC_API_INVENTORY}/suppliers`)
      .then((res) => setSuppliers(res.data))
      .catch((err) => console.error("Error al cargar proveedores", err));

    // Cargar marcas
    axios
      .get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/brands`)
      .then((res) => setBrands(res.data))
      .catch((err) => console.error("Error al cargar marcas", err));
  }, []);

  // =========================
  // Cargar datos del producto si está en modo edición
  // =========================
  useEffect(() => {
    if (!editVariantId) return;

    const loadProductForEdit = async () => {
      setIsLoadingProduct(true);
      setIsEditMode(true);

      try {
        // Obtener la variante y su producto
        const { data: variants } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/multiple/by-ids`,
          { ids: [editVariantId] },
        );

        if (variants.length === 0) {
          toast.error("No se encontró el producto");
          return;
        }

        const variant = variants[0];
        const product = variant.product;
        setEditProductId(product.id);

        // Obtener detalles completos del producto CON relaciones (subcategory, etc.)
        const { data: productDetailsArray } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/details`,
          { productIds: [product.id] },
        );

        if (!productDetailsArray || productDetailsArray.length === 0) {
          toast.error("No se encontraron detalles del producto");
          setIsLoadingProduct(false);
          return;
        }

        const productDetails = productDetailsArray[0];

        // Obtener subcategoryId de la relación
        const subcategoryId = productDetails.subcategory?.id;

        if (!subcategoryId) {
          console.error(
            "No se encontró subcategoryId en productDetails:",
            productDetails,
          );
          toast.error("No se pudo obtener la subcategoría del producto");
          setIsLoadingProduct(false);
          return;
        }

        // Obtener la categoría de la subcategoría (ya viene incluida en productDetails)
        const categoryId = productDetails.subcategory?.category?.id;

        // Cargar subcategorías de la categoría para el select
        const { data: subcategoriesData } = await axios.get(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/category/${categoryId}`,
        );
        setSubcategories(subcategoriesData);

        // Obtener atributos default de la subcategoría
        const { data: subcategoryData } = await axios.get(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/${subcategoryId}`,
        );

        // Cargar atributos default de la subcategoría
        const attrs: DefaultAttribute[] =
          subcategoryData.defaultAttributes || [];
        setDefaultAttributes(attrs);

        // Llenar el formulario
        setForm({
          name: product.name || "",
          description: product.description || "",
          categoryId: categoryId || "",
          subcategoryId: subcategoryId || "",
          inventory_id: product.inventory_id || "",
          supplierId: productDetails.supplier?.id || "",
          brandId: productDetails.brand?.id || "",
        });

        // Llenar la variante con sus valores
        const variantForm: VariantForm = {
          attributes: variant.attributeValues || {},
          priceBase: Number(variant.priceBase) || 0,
          priceVta: Number(variant.priceVta) || 0,
          stock: 0, // El stock se maneja en inventario
          minStock: 0,
          imageFile: null,
        };
        setVariants([variantForm]);

        // Llenar los valores de atributos
        const attrVals: Record<string, string> = {};
        attrs.forEach((attr) => {
          const val = variant.attributeValues?.[attr.name];
          if (val) {
            attrVals[attr.id] = val;
          }
        });
        setAttributeValues(attrVals);
      } catch (error) {
        console.error("Error cargando producto para editar:", error);
        toast.error("Error al cargar el producto");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    loadProductForEdit();
  }, [editVariantId]);

  // Auto-seleccionar inventario si solo hay uno
  useEffect(() => {
    if (inventories.length === 1 && !form.inventory_id && !isEditMode) {
      setForm((prev) => ({
        ...prev,
        inventory_id: inventories[0].id,
      }));
    }
  }, [inventories, isEditMode]);

  // =========================
  // Cargar subcategorías al cambiar categoría
  // =========================
  useEffect(() => {
    // No resetear en modo edición durante la carga inicial
    if (isEditMode && isLoadingProduct) return;

    // Solo resetear si el usuario cambió la categoría manualmente
    if (!isEditMode || (isEditMode && !isLoadingProduct)) {
      setSubcategories([]);
      setDefaultAttributes([]);
      setAttributeValues({});
      setCustomAttributes([]);
      setVariants([]);
    }

    if (!form.categoryId) return;

    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/category/${form.categoryId}`,
      )
      .then((res) => setSubcategories(res.data))
      .catch((err) => console.error("Error al cargar subcategorías", err));
  }, [form.categoryId, isEditMode, isLoadingProduct]);

  // =========================
  // Cargar atributos default al cambiar subcategoría
  // =========================
  useEffect(() => {
    // No resetear en modo edición durante la carga inicial
    if (isEditMode && isLoadingProduct) return;

    // Solo resetear si el usuario cambió la subcategoría manualmente
    if (!isEditMode || (isEditMode && !isLoadingProduct)) {
      setDefaultAttributes([]);
      setAttributeValues({});
      setCustomAttributes([]);
      setVariants([]);
    }

    if (!form.subcategoryId) return;

    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/${form.subcategoryId}`,
      )
      .then((res) => {
        const attrs: DefaultAttribute[] = res.data.defaultAttributes || [];
        setDefaultAttributes(attrs);

        // Solo inicializar valores vacíos si no estamos en modo edición
        if (!isEditMode) {
          const initialValues: Record<string, string> = {};
          attrs.forEach((attr) => {
            initialValues[attr.id] = "";
          });
          setAttributeValues(initialValues);
        }
      })
      .catch((err) => console.error("Error cargando atributos default", err));
  }, [form.subcategoryId, isEditMode, isLoadingProduct]);

  // Filtrar marcas cuando cambia el proveedor
  useEffect(() => {
    if (form.supplierId) {
      const filtered = brands.filter(
        (brand) => brand.supplier?.id === form.supplierId,
      );
      setFilteredBrands(filtered);
      // Resetear marca si ya no pertenece al proveedor seleccionado
      if (form.brandId) {
        const brandBelongsToSupplier = filtered.some(
          (b) => b.id === form.brandId,
        );
        if (!brandBelongsToSupplier) {
          setForm((prev) => ({ ...prev, brandId: "" }));
        }
      }
    } else {
      setFilteredBrands([]);
      setForm((prev) => ({ ...prev, brandId: "" }));
    }
  }, [form.supplierId, brands]);

  // =========================
  // Manejo inputs base
  // =========================
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =========================
  // Manejo atributos default (multi valor)
  // =========================
  const handleAttributeChange = (attrId: string, rawValue: string) => {
    setAttributeValues((prev) => ({
      ...prev,
      [attrId]: rawValue,
    }));
  };

  const parseAttributeValues = (rawValue: string): string[] => {
    return rawValue
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  };

  // =========================
  // Atributos CUSTOM
  // =========================
  const handleAddCustomAttribute = () => {
    const newAttr: CustomAttribute = {
      id: `custom_${Date.now()}`,
      name: "",
      rawValues: "",
    };
    setCustomAttributes((prev) => [...prev, newAttr]);
  };

  const handleCustomAttrNameChange = (id: string, name: string) => {
    setCustomAttributes((prev) =>
      prev.map((attr) => (attr.id === id ? { ...attr, name } : attr)),
    );
  };

  const handleCustomAttrValuesChange = (id: string, rawValues: string) => {
    setCustomAttributes((prev) =>
      prev.map((attr) => (attr.id === id ? { ...attr, rawValues } : attr)),
    );
  };

  // Parsear valores raw a array (usado al generar variantes)
  const parseCustomAttrValues = (rawValues: string): string[] => {
    return rawValues
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  };

  const handleRemoveCustomAttr = (id: string) => {
    setCustomAttributes((prev) => prev.filter((a) => a.id !== id));
  };

  // =========================
  // Generar variantes
  // =========================
  const handleGenerateVariants = () => {
    const mapByName: Record<string, string[]> = {};

    defaultAttributes.forEach((attr) => {
      const rawValue = attributeValues[attr.id] || "";
      const parsed = parseAttributeValues(rawValue);
      if (parsed.length > 0) {
        mapByName[attr.name] = parsed;
      }
    });

    customAttributes.forEach((attr) => {
      const values = parseCustomAttrValues(attr.rawValues);
      if (attr.name && values.length > 0) {
        mapByName[attr.name] = values;
      }
    });

    const combos = generateCartesian(mapByName);

    const newVariants: VariantForm[] = combos.map((combo) => ({
      attributes: combo as Record<string, string>,
      priceBase: 0,
      priceVta: 0,
      stock: 0,
      minStock: 0,
      imageFile: null,
    }));

    setVariants(newVariants);
    setMessage(`✅ ${newVariants.length} variantes generadas`);
  };

  // =========================
  // Manejo de campos de cada variante
  // =========================
  const updateVariantField = (
    index: number,
    field: keyof Omit<VariantForm, "attributes">,
    value: any,
  ) => {
    setVariants((prev) =>
      prev.map((v, i) =>
        i === index
          ? {
              ...v,
              [field]:
                field === "priceBase" ||
                field === "priceVta" ||
                field === "stock"
                  ? Number(value)
                  : value,
            }
          : v,
      ),
    );
  };

  // =========================
  // Quick create Supplier/Brand
  // =========================
  const handleQuickCreateSupplier = async () => {
    if (!quickSupplierName.trim()) {
      toast.error("El nombre del proveedor es requerido");
      return;
    }

    setIsCreatingSupplier(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/suppliers`,
        { name: quickSupplierName.trim(), companyId: auth?.company?.id },
      );

      toast.success("Proveedor creado exitosamente");

      // Recargar proveedores
      const suppliersRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_INVENTORY}/suppliers`,
      );
      setSuppliers(suppliersRes.data);

      // Seleccionar el nuevo proveedor
      setForm((prev) => ({ ...prev, supplierId: res.data.id }));

      // Cerrar modal y limpiar
      setSupplierModalOpen(false);
      setQuickSupplierName("");
    } catch (error) {
      console.error("Error creating supplier", error);
      toast.error("Error al crear proveedor");
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  const handleQuickCreateBrand = async () => {
    if (!quickBrandName.trim()) {
      toast.error("El nombre de la marca es requerido");
      return;
    }

    if (!form.supplierId) {
      toast.error("Primero selecciona un proveedor");
      return;
    }

    setIsCreatingBrand(true);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/brands`,
        {
          name: quickBrandName.trim(),
          supplierId: form.supplierId,
        },
      );

      toast.success("Marca creada exitosamente");

      // Recargar marcas
      const brandsRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/brands`,
      );
      setBrands(brandsRes.data);

      // Seleccionar la nueva marca
      setForm((prev) => ({ ...prev, brandId: res.data.id }));

      // Cerrar modal y limpiar
      setBrandModalOpen(false);
      setQuickBrandName("");
    } catch (error) {
      console.error("Error creating brand", error);
      toast.error("Error al crear marca");
    } finally {
      setIsCreatingBrand(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      categoryId: "",
      description: "",
      subcategoryId: "",
      inventory_id: "",
      supplierId: "",
      brandId: "",
    });

    setDefaultAttributes([]);
    setAttributeValues({});
    setCustomAttributes([]);
    setVariants([]);
    setMessage("");
  };

  const handleVariantImageChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0] || null;
    updateVariantField(index, "imageFile", file);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // =========================
  // Submit
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!form.inventory_id) {
      toast.error("Debe seleccionar un inventario.");
      return;
    }

    if (!form.name || !form.categoryId || !form.subcategoryId) {
      toast.error("Completa nombre, categoría y subcategoría.");
      return;
    }

    if (variants.length === 0) {
      toast.error("Genera al menos una variante.");
      return;
    }

    // Validar precios (y stock solo en modo creación)
    for (const v of variants) {
      if (v.priceBase <= 0 || v.priceVta <= 0) {
        toast.error(
          "Todas las variantes deben tener precio base y precio venta mayor a 0.",
        );
        return;
      }
      // Solo validar stock en modo creación
      if (!isEditMode && v.stock < 0) {
        toast.error("El stock no puede ser negativo.");
        return;
      }
    }

    setIsSubmitting(true);

    // Armar payload "teórico" para el backend
    const attributesPayload = [
      // default attributes
      ...defaultAttributes.map((attr, index) => ({
        attributeId: attr.id,
        isActive: true,
        sortOrder: index,
      })),
      // custom attributes
      ...customAttributes
        .filter((a) => a.name && parseCustomAttrValues(a.rawValues).length > 0)
        .map((attr, idx) => {
          const values = parseCustomAttrValues(attr.rawValues);
          return {
            customAttribute: {
              name: attr.name,
              type: "input",
              required: true,
              options: values.map((v: string) => ({ value: v })),
            },
            isActive: true,
            sortOrder: defaultAttributes.length + idx,
          };
        }),
    ];

    const variantsPayload = variants.map((v, index) => ({
      attributeValues: v.attributes,
      priceBase: v.priceBase,
      priceVta: v.priceVta,
      stock: v.stock,
      minStock: Number(v.minStock),
      images: [],
    }));

    const payload = {
      name: form.name,
      description: form.description,
      companyId: auth?.company?.id,
      subcategoryId: form.subcategoryId,
      inventory_id: form.inventory_id,
      supplierId: form.supplierId || null,
      brandId: form.brandId || null,
      attributes: attributesPayload,
      variants: variantsPayload,
    };

    try {
      if (isEditMode && editVariantId && editProductId) {
        // Modo edición: actualizar la variante existente
        const variantToUpdate = variants[0];
        const variantPayload = {
          priceBase: variantToUpdate.priceBase,
          priceVta: variantToUpdate.priceVta,
          attributeValues: variantToUpdate.attributes,
        };

        // Actualizar la variante
        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/product-variant/${editVariantId}`,
          variantPayload,
        );

        // Actualizar el producto (nombre, descripción)
        const productPayload = {
          name: form.name,
          description: form.description,
        };

        await axios.patch(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/${editProductId}`,
          productPayload,
        );

        toast.success("¡Producto actualizado exitosamente!");
        // Redirigir al inventario
        window.history.back();
      } else {
        // Modo creación
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/with-variants`,
          payload,
        );

        toast.success("¡Producto creado exitosamente!");
        resetForm();
      }
    } catch (error) {
      console.error("❌ Error al guardar producto:", error);
      toast.error(
        isEditMode
          ? "Error al actualizar el producto."
          : "Error al crear el producto. Intenta nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  return (
    <form onSubmit={handleSubmit} className="w-full px-6 pb-6">
      <HeaderConfig
        title="Productos"
        description={isEditMode ? "Editar producto" : "Crear nuevo producto"}
      />

      {isLoadingProduct ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">
            Cargando datos del producto...
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card 1: Información básica */}
          <Card>
            <CardHeader>
              <CardTitle>Información básica</CardTitle>
              <CardDescription>
                Completa los datos principales del producto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Row: Inventario + Categoría */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inventory_id">Inventario</Label>
                  <select
                    id="inventory_id"
                    name="inventory_id"
                    value={form.inventory_id}
                    onChange={handleChange}
                    className="w-full border rounded-lg p-2 bg-background text-foreground dark:bg-gray-800 dark:border-gray-600"
                    disabled={inventories.length === 1}
                    required
                  >
                    <option value="">Seleccionar inventario...</option>
                    {inventories.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryId">Categoría</Label>
                  <select
                    id="categoryId"
                    name="categoryId"
                    value={form.categoryId}
                    onChange={handleChange}
                    className="w-full border rounded-lg p-2 bg-background text-foreground dark:bg-gray-800 dark:border-gray-600"
                    required
                  >
                    <option value="">Seleccionar categoría...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Proveedor + Marca */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplierId">
                    Proveedor{" "}
                    <span className="text-muted-foreground text-xs">
                      (opcional)
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <select
                      id="supplierId"
                      name="supplierId"
                      value={form.supplierId}
                      onChange={handleChange}
                      className="flex-1 border rounded-lg p-2 bg-background text-foreground dark:bg-gray-800 dark:border-gray-600"
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSupplierModalOpen(true)}
                      title="Crear nuevo proveedor"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brandId">
                    Marca{" "}
                    <span className="text-muted-foreground text-xs">
                      (opcional)
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <select
                      id="brandId"
                      name="brandId"
                      value={form.brandId}
                      onChange={handleChange}
                      disabled={!form.supplierId}
                      className="flex-1 border rounded-lg p-2 bg-background text-foreground dark:bg-gray-800 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-700"
                    >
                      {!form.supplierId ? (
                        <option value="">
                          Selecciona proveedor primero...
                        </option>
                      ) : (
                        <>
                          <option value="">Seleccionar marca...</option>
                          {filteredBrands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setBrandModalOpen(true)}
                      disabled={!form.supplierId}
                      title="Crear nueva marca"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ej: Remera Oversize Premium"
                  required
                />
              </div>

              {/* Subcategoría */}
              <div className="space-y-2">
                <Label htmlFor="subcategoryId">Subcategoría</Label>
                <select
                  id="subcategoryId"
                  name="subcategoryId"
                  value={form.subcategoryId}
                  onChange={handleChange}
                  disabled={!form.categoryId}
                  className="w-full border rounded-lg p-2 bg-background text-foreground dark:bg-gray-800 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-700"
                  required
                >
                  {!form.categoryId ? (
                    <option value="">Selecciona categoría primero...</option>
                  ) : (
                    <>
                      <option value="">Seleccionar subcategoría...</option>
                      {subcategories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Ej: Remera unisex de algodón premium, modelo oversize."
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Atributos del producto */}
          <Card>
            <CardHeader>
              <CardTitle>Atributos del producto</CardTitle>
              <CardDescription>
                Selecciona una subcategoría para ver los atributos por defecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Default attributes */}
              {defaultAttributes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {defaultAttributes.map((attr) => (
                    <div key={attr.id} className="space-y-2">
                      <Label>
                        {attr.name} {attr.required && "*"}{" "}
                        <span className="text-xs text-muted-foreground">
                          (separa valores con coma)
                        </span>
                      </Label>
                      <Input
                        value={attributeValues[attr.id] || ""}
                        onChange={(e) =>
                          handleAttributeChange(attr.id, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Botón generar variantes */}
              {(defaultAttributes.length > 0 ||
                customAttributes.length > 0) && (
                <Button
                  type="button"
                  onClick={handleGenerateVariants}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Generar variantes
                </Button>
              )}

              {/* Custom attributes header */}
              <div className="flex items-center justify-between pt-2">
                <Label className="text-base">Atributos personalizados</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomAttribute}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Agregar atributo
                </Button>
              </div>

              {customAttributes.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    No hay atributos personalizados. Haz clic en &quot;Agregar
                    atributo&quot; para añadir uno.
                  </p>
                </div>
              )}

              {customAttributes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customAttributes.map((attr) => (
                    <div
                      key={attr.id}
                      className="border rounded-lg p-4 space-y-3 bg-muted/30"
                    >
                      <div className="space-y-2">
                        <Label>Nombre del atributo</Label>
                        <Input
                          value={attr.name}
                          onChange={(e) =>
                            handleCustomAttrNameChange(attr.id, e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Valores (separados por coma)</Label>
                        <Input
                          value={attr.rawValues}
                          onChange={(e) =>
                            handleCustomAttrValuesChange(
                              attr.id,
                              e.target.value,
                            )
                          }
                          placeholder="Ej: S, M, L, XL"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleRemoveCustomAttr(attr.id)}
                      >
                        Eliminar atributo
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Variantes generadas */}
              {variants.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold">Variantes generadas</h3>

                  {variants.map((variant, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-muted/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">
                          Variante {index + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleRemoveVariant(index)}
                        >
                          Eliminar
                        </Button>
                      </div>

                      {/* Atributos de la variante */}
                      <p className="text-s text-muted-foreground">
                        {Object.entries(variant.attributes)
                          .map(([name, value]) => `${name}: ${value}`)
                          .join(" | ")}
                      </p>

                      {/* Datos de la variante */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Precio base</Label>
                          <Input
                            type="number"
                            value={variant.priceBase || ""}
                            onChange={(e) =>
                              updateVariantField(
                                index,
                                "priceBase",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Precio venta</Label>
                          <Input
                            type="number"
                            value={variant.priceVta || ""}
                            onChange={(e) =>
                              updateVariantField(
                                index,
                                "priceVta",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Stock</Label>
                          <Input
                            type="number"
                            value={variant.stock || ""}
                            onChange={(e) =>
                              updateVariantField(index, "stock", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Stock mínimo</Label>
                          <Input
                            type="number"
                            value={variant.minStock || ""}
                            onChange={(e) =>
                              updateVariantField(
                                index,
                                "minStock",
                                e.target.value,
                              )
                            }
                          />
                        </div>

                        {/*  <div className="space-y-1">
                        <Label className="text-xs">Imagen (opcional)</Label>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground"
                          onChange={(e) => handleVariantImageChange(index, e)}
                        />
                        {variant.imageFile && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {variant.imageFile.name}
                          </p>
                        )}
                      </div> */}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submit buttons */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            "Crear Producto"
          )}
        </Button>
      </div>

      {/* Modal: Crear Proveedor Rápido */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quick-supplier-name">
                Nombre del Proveedor *
              </Label>
              <Input
                id="quick-supplier-name"
                value={quickSupplierName}
                onChange={(e) => setQuickSupplierName(e.target.value)}
                placeholder="Ej: Nike, Adidas..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickCreateSupplier();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSupplierModalOpen(false);
                setQuickSupplierName("");
              }}
              disabled={isCreatingSupplier}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleQuickCreateSupplier}
              disabled={isCreatingSupplier}
            >
              {isCreatingSupplier ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear Marca Rápida */}
      <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input
                value={
                  suppliers.find((s) => s.id === form.supplierId)?.name || ""
                }
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-brand-name">Nombre de la Marca *</Label>
              <Input
                id="quick-brand-name"
                value={quickBrandName}
                onChange={(e) => setQuickBrandName(e.target.value)}
                placeholder="Ej: Air Jordan, Ultraboost..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickCreateBrand();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBrandModalOpen(false);
                setQuickBrandName("");
              }}
              disabled={isCreatingBrand}
            >
              Cancelar
            </Button>
            <Button onClick={handleQuickCreateBrand} disabled={isCreatingBrand}>
              {isCreatingBrand ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
