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
    inventory_id: "5e68e71d-c987-4e68-9688-d0ea9199aaa7", // por ahora fijo
    quantity: 0,
    min_stock: 0,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 1️⃣ Cargar categorías al montar el componente
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get("http://localhost:3005/categories");
        setCategories(res.data);
      } catch (error) {
        console.error("Error al cargar categorías", error);
      }
    };

    fetchCategories();
  }, []);

  // 2️⃣ Cuando cambia categoryId → cargar subcategorías
  useEffect(() => {
    if (!form.categoryId) return;

    const fetchSubcategories = async () => {
      try {
        const res = await axios.get(
          `http://localhost:3005/sub-categories?categoryId=${form.categoryId}`
        );
        setSubcategories(res.data);
      } catch (error) {
        console.error("Error al cargar subcategorías", error);
      }
    };

    fetchSubcategories();
  }, [form.categoryId]);

  // 3️⃣ Manejo de inputs
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

  // 4️⃣ Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await axios.post(`http://localhost:3005/products`, {
        ...form,
        subcategoryId: form.subcategoryId,
      });

      setMessage("Producto creado con éxito ✔️");

      // Reset de form
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
