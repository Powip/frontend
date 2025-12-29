"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  values: string[];
}

interface VariantForm {
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

export default function ProductCreateForm() {
  const { auth, inventories } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<CreateProductBase>({
    name: "",
    description: "",
    categoryId: "",
    subcategoryId: "",
    inventory_id: "",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [defaultAttributes, setDefaultAttributes] = useState<
    DefaultAttribute[]
  >([]);

  const [attributeValues, setAttributeValues] = useState<
    Record<string, string>
  >({});

  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(
    []
  );

  const [variants, setVariants] = useState<VariantForm[]>([]);
  const [message, setMessage] = useState("");

  // =========================
  // Cargar categorías
  // =========================
  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_PRODUCTOS}/categories`)
      .then((res) => setCategories(res.data))
      .catch((err) => console.error("Error al cargar categorías", err));
  }, []);

  // Auto-seleccionar inventario si solo hay uno
  useEffect(() => {
    if (inventories.length === 1 && !form.inventory_id) {
      setForm((prev) => ({
        ...prev,
        inventory_id: inventories[0].id,
      }));
    }
  }, [inventories]);

  // =========================
  // Cargar subcategorías al cambiar categoría
  // =========================
  useEffect(() => {
    setSubcategories([]);
    setDefaultAttributes([]);
    setAttributeValues({});
    setCustomAttributes([]);
    setVariants([]);

    if (!form.categoryId) return;

    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/category/${form.categoryId}`
      )
      .then((res) => setSubcategories(res.data))
      .catch((err) => console.error("Error al cargar subcategorías", err));
  }, [form.categoryId]);

  // =========================
  // Cargar atributos default al cambiar subcategoría
  // =========================
  useEffect(() => {
    setDefaultAttributes([]);
    setAttributeValues({});
    setCustomAttributes([]);
    setVariants([]);

    if (!form.subcategoryId) return;

    axios
      .get(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/subcategories/${form.subcategoryId}`
      )
      .then((res) => {
        const attrs: DefaultAttribute[] = res.data.defaultAttributes || [];
        setDefaultAttributes(attrs);

        const initialValues: Record<string, string> = {};
        attrs.forEach((attr) => {
          initialValues[attr.id] = "";
        });
        setAttributeValues(initialValues);
      })
      .catch((err) => console.error("Error cargando atributos default", err));
  }, [form.subcategoryId]);

  // =========================
  // Manejo inputs base
  // =========================
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
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
      values: [],
    };
    setCustomAttributes((prev) => [...prev, newAttr]);
  };

  const handleCustomAttrNameChange = (id: string, name: string) => {
    setCustomAttributes((prev) =>
      prev.map((attr) => (attr.id === id ? { ...attr, name } : attr))
    );
  };

  const handleCustomAttrValuesChange = (id: string, raw: string) => {
    const values = raw
      .replace(/\s*,\s*/g, ",")
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    setCustomAttributes((prev) =>
      prev.map((attr) => (attr.id === id ? { ...attr, values } : attr))
    );
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
      if (attr.name && attr.values.length > 0) {
        mapByName[attr.name] = attr.values;
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
    value: any
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
          : v
      )
    );
  };

  const resetForm = () => {
    setForm({
      name: "",
      categoryId: "",
      description: "",
      subcategoryId: "",
      inventory_id: "",
    });

    setDefaultAttributes([]);
    setAttributeValues({});
    setCustomAttributes([]);
    setVariants([]);
    setMessage("");
  };

  const handleVariantImageChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
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

    // Validar precios y stock
    for (const v of variants) {
      if (v.priceBase <= 0 || v.priceVta <= 0 || v.stock < 0) {
        toast.error(
          "Todas las variantes deben tener precio base, precio venta y stock mayor a 0."
        );
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
        .filter((a) => a.name && a.values.length > 0)
        .map((attr, idx) => ({
          customAttribute: {
            name: attr.name,
            type: "input",
            required: true,
            options: attr.values.map((v) => ({ value: v })),
          },
          isActive: true,
          sortOrder: defaultAttributes.length + idx,
        })),
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
      attributes: attributesPayload,
      variants: variantsPayload,
    };

    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/with-variants`,
        payload
      );
      console.log(res);

      toast.success("¡Producto creado exitosamente!");
      resetForm();
    } catch (error) {
      console.error("❌ Error al crear producto:", error);
      toast.error("Error al crear el producto. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // RENDER
  // =========================
  return (
    <form onSubmit={handleSubmit} className="w-full px-6 pb-6">
      <HeaderConfig title="Productos" description="Crear nuevo producto" />

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
                  No hay atributos personalizados. Haz clic en "Agregar atributo" para añadir uno.
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
                        value={attr.values.join(", ")}
                        onChange={(e) =>
                          handleCustomAttrValuesChange(attr.id, e.target.value)
                        }
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

            {/* Botón generar variantes */}
            {(defaultAttributes.length > 0 || customAttributes.length > 0) && (
              <Button
                type="button"
                onClick={handleGenerateVariants}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Generar variantes
              </Button>
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
                      <p className="font-semibold text-sm">Variante {index + 1}</p>
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
                    <p className="text-xs text-muted-foreground">
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
                            updateVariantField(index, "priceBase", e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Precio venta</Label>
                        <Input
                          type="number"
                          value={variant.priceVta || ""}
                          onChange={(e) =>
                            updateVariantField(index, "priceVta", e.target.value)
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
                            updateVariantField(index, "minStock", e.target.value)
                          }
                        />
                      </div>

                      <div className="space-y-1">
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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

      {message && (
        <p className="text-sm font-medium text-muted-foreground mt-3 text-center">
          {message}
        </p>
      )}
    </form>
  );
}
