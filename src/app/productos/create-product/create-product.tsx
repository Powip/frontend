"use client";
import { useEffect, useState } from "react";
import axios from "axios";

import { Card } from "@/components/ui/card";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { useAuth } from "@/contexts/AuthContext";

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
  minStock: number; // ← nuevo
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
  // Submit (solo console.log)
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!form.inventory_id) {
      setMessage("Debe seleccionar un inventario.");
      return;
    }

    if (!form.name || !form.categoryId || !form.subcategoryId) {
      setMessage("Completa nombre, categoría y subcategoría.");
      return;
    }

    if (variants.length === 0) {
      setMessage("Generá al menos una variante.");
      return;
    }

    // Validar precios y stock
    for (const v of variants) {
      if (v.priceBase <= 0 || v.priceVta <= 0 || v.stock < 0) {
        setMessage(
          "Todas las variantes deben tener precio base, precio venta y stock mayor a 0."
        );
        return;
      }
    }

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
    console.log(payload);
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_PRODUCTOS}/products/with-variants`,
        payload
      );

      setMessage("✅ Producto creado correctamente con variantes.");

      resetForm();
    } catch (error) {
      console.error("❌ Error al crear producto:", error);
    }
  };

  // =========================
  // RENDER
  // =========================
  return (
    <form onSubmit={handleSubmit} className="w-full px-6 pb-6">
      <HeaderConfig title="Productos" description="Crear nuevo producto" />

      <Card className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold">Inventario</label>

          <select
            name="inventory_id"
            value={form.inventory_id}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg p-2"
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
        {/* Datos base del producto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold">Nombre</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="mt-1 w-full border rounded-lg p-2"
              placeholder="Ej: Remera Oversize Premium"
              required
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-sm font-semibold">Categoría</label>
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="mt-1 w-full border rounded-lg p-2"
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

          {/* Subcategoría */}
          <div>
            <label className="block text-sm font-semibold">Subcategoría</label>
            <select
              name="subcategoryId"
              value={form.subcategoryId}
              onChange={handleChange}
              disabled={!form.categoryId}
              className="mt-1 w-full border rounded-lg p-2 disabled:bg-gray-200"
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
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold">Descripción</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="mt-1 w-full border rounded-lg p-2"
              placeholder="Ej: Remera unisex de algodón premium, modelo oversize."
            />
          </div>
        </div>

        {/* Atributos del producto */}
        <div className="border-t pt-4 space-y-4">
          <h3 className="font-semibold mb-1">Atributos del producto</h3>

          {/* Default attributes */}
          {defaultAttributes.length === 0 && (
            <p className="text-sm text-gray-500">
              Selecciona una subcategoría para ver los atributos por defecto.
            </p>
          )}

          {defaultAttributes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {defaultAttributes.map((attr) => (
                <div key={attr.id}>
                  <label className="block text-sm font-semibold mb-1">
                    {attr.name} {attr.required && "*"}{" "}
                    <span className="text-xs text-gray-500">
                      (separa valores con coma)
                    </span>
                  </label>
                  <input
                    className="w-full border rounded-lg p-2"
                    value={attributeValues[attr.id] || ""}
                    onChange={(e) =>
                      handleAttributeChange(attr.id, e.target.value)
                    }
                    placeholder="Ej: S, M, L, XL"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Custom attributes */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">
                Atributos personalizados
              </h4>
              <button
                type="button"
                className="text-xs bg-gray-900 text-white px-3 py-1 rounded-lg"
                onClick={handleAddCustomAttribute}
              >
                Agregar atributo
              </button>
            </div>

            {customAttributes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customAttributes.map((attr) => (
                  <div
                    key={attr.id}
                    className="border rounded-lg p-3 flex flex-col gap-2"
                  >
                    <div>
                      <label className="block text-xs font-semibold">
                        Nombre del atributo
                      </label>
                      <input
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="Ej: Material"
                        value={attr.name}
                        onChange={(e) =>
                          handleCustomAttrNameChange(attr.id, e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold">
                        Valores (separados por coma)
                      </label>
                      <input
                        className="w-full border rounded-lg p-2 text-sm"
                        placeholder="Ej: Algodón, Poliéster"
                        value={attr.values.join(", ")}
                        onChange={(e) =>
                          handleCustomAttrValuesChange(attr.id, e.target.value)
                        }
                      />
                    </div>

                    <button
                      type="button"
                      className="self-end text-xs text-red-600"
                      onClick={() => handleRemoveCustomAttr(attr.id)}
                    >
                      Eliminar atributo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón generar variantes */}
          {(defaultAttributes.length > 0 || customAttributes.length > 0) && (
            <button
              type="button"
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
              onClick={handleGenerateVariants}
            >
              Generar variantes
            </button>
          )}
        </div>

        {/* Variantes generadas */}
        {variants.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold mb-1">Variantes generadas</h3>

            {variants.map((variant, index) => (
              <div
                key={index}
                className="border rounded-lg p-3 bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Variante {index + 1}</p>
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => handleRemoveVariant(index)}
                  >
                    Eliminar
                  </button>
                </div>

                {/* Atributos de la variante */}
                <p className="text-xs text-gray-700">
                  {Object.entries(variant.attributes)
                    .map(([name, value]) => `${name}: ${value}`)
                    .join(" | ")}
                </p>

                {/* Datos de la variante */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                  <div>
                    <label className="block text-xs font-semibold">
                      Precio base
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={variant.priceBase || ""}
                      onChange={(e) =>
                        updateVariantField(index, "priceBase", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold">
                      Precio venta
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={variant.priceVta || ""}
                      onChange={(e) =>
                        updateVariantField(index, "priceVta", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold">Stock</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={variant.stock || ""}
                      onChange={(e) =>
                        updateVariantField(index, "stock", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold">
                      Stock mínimo (alerta)
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={variant.minStock || ""}
                      onChange={(e) =>
                        updateVariantField(index, "minStock", e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold">
                      Imagen (opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-xs"
                      onChange={(e) => handleVariantImageChange(index, e)}
                    />
                    {variant.imageFile && (
                      <p className="text-[10px] text-gray-600 mt-1">
                        {variant.imageFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Submit */}
      <button
        type="submit"
        className="mt-4 bg-green-600 text-white px-6 py-3 rounded-lg text-sm"
      >
        Crear Producto
      </button>

      {message && (
        <p className="text-sm font-medium text-gray-700 mt-3">{message}</p>
      )}
    </form>
  );
}
