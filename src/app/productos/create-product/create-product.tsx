"use client";

import { useEffect, useState } from "react";
import axios from "axios";

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  name: string;
}

interface CreateProductDto {
  name: string;
  description: string;
  priceBase: number;
  priceVta: number;
  categoryId: string;
  subcategoryId: string;
  inventory_id: string;
  quantity: number;
  min_stock: number;
}

export default function ProductCreateForm() {
  const [form, setForm] = useState<CreateProductDto>({
    name: "",
    description: "",
    priceBase: 0,
    priceVta: 0,
    categoryId: "",
    subcategoryId: "",
    inventory_id: "5e68e71d-c987-4e68-9688-d0ea9199aaa7",
    quantity: 0,
    min_stock: 0,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 1️⃣ Cargar categorías
  useEffect(() => {
    axios
      .get("http://localhost:3005/categories")
      .then((res) => setCategories(res.data))
      .catch((err) => console.error("Error al cargar categorías", err));
  }, []);

  // 2️⃣ Cargar subcategorías cuando cambia la categoría
  useEffect(() => {
    if (!form.categoryId) return;

    axios
      .get(
        `http://localhost:3005/sub-categories?categoryId=${form.categoryId}`
      )
      .then((res) => setSubcategories(res.data))
      .catch((err) => console.error("Error al cargar subcategorías", err));
  }, [form.categoryId]);

  // 3️⃣ Manejo de inputs normales
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        name === "priceBase" ||
        name === "priceVta" ||
        name === "quantity" ||
        name === "min_stock"
          ? Number(value)
          : value,
    }));
  };

  // 4️⃣ Manejo del archivo de imagen
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);

    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  // 5️⃣ Enviar formulario con FormData
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("description", form.description);
      formData.append("priceBase", String(form.priceBase));
      formData.append("priceVta", String(form.priceVta));
      formData.append("categoryId", form.categoryId);
      formData.append("subcategoryId", form.subcategoryId);
      formData.append("inventory_id", form.inventory_id);
      formData.append("quantity", String(form.quantity));
      formData.append("min_stock", String(form.min_stock));

      if (imageFile) {
        formData.append("image", imageFile);
      }

      await axios.post(`http://localhost:3005/products`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("Producto creado con éxito ✔️");

      setForm({
        name: "",
        description: "",
        priceBase: 0,
        priceVta: 0,
        categoryId: "",
        subcategoryId: "",
        inventory_id: form.inventory_id,
        quantity: 0,
        min_stock: 0,
      });

      setSubcategories([]);
      setImageFile(null);
      setPreview(null);
    } catch (error) {
      console.error(error);
      setMessage("❌ Error al crear el producto");
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full p-6 space-y-6">
      <h2 className="text-3xl font-bold">Crear Producto</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-semibold">Nombre</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg p-2"
            placeholder="Ej: Remera Oversize Negra"
            required
          />
        </div>

        {/* Precio base */}
        <div>
          <label className="block text-sm font-semibold">Precio base</label>
          <input
            type="number"
            name="priceBase"
            value={form.priceBase}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg p-2"
            placeholder="Ej: 8500"
            required
          />
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
            placeholder="Remera unisex de algodón premium, modelo oversize."
          />
        </div>

        {/* Precio venta */}
        <div>
          <label className="block text-sm font-semibold">Precio venta</label>
          <input
            type="number"
            name="priceVta"
            value={form.priceVta}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg p-2"
            placeholder="Ej: 12999"
            required
          />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-semibold">Cantidad</label>
          <input
            type="number"
            name="quantity"
            value={form.quantity}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg p-2"
            placeholder="Ej: 15"
          />
        </div>

        {/* Stock mínimo */}
        <div>
          <label className="block text-sm font-semibold">Stock mínimo</label>
          <input
            type="number"
            name="min_stock"
            value={form.min_stock}
            onChange={handleChange}
            className="mt-1 w-full border rounded-lg p-2"
            placeholder="Ej: 2"
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
            className="mt-1 w-full border rounded-lg p-2"
            disabled={!subcategories.length}
            required
          >
            <option value="">Seleccionar subcategoría...</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Imagen */}
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold">Imagen del producto</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="mt-1 w-full border rounded-lg p-2"
          />

          {/* Vista previa */}
          {preview && (
            <img
              src={preview}
              alt="preview"
              className="mt-4 w-48 h-48 object-cover rounded-lg border"
            />
          )}
        </div>
      </div>

      {/* Botón */}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
      >
        {loading ? "Creando producto..." : "Crear Producto"}
      </button>

      {message && (
        <p className="text-sm font-medium text-gray-700">{message}</p>
      )}
    </form>
  );
}
