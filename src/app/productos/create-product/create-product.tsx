"use client";

import { useState } from "react";
import axios from "axios";

interface CreateProductDto {
  name: string;
  description: string;
  priceBase: number;
  priceVta: number;
  companyId: string;
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
    companyId: "7b3f8d73-5b8a-4f3c-b786-919b5fddcbb1",
    subcategoryId: "b983605a-f828-486d-82cd-6280cc66d82a",
    inventory_id: "5e68e71d-c987-4e68-9688-d0ea9199aaa7",
    quantity: 0,
    min_stock: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        "http://localhost:3005/products",
        form
      );

      console.log("Producto creado:", response.data);
      setMessage("Producto creado con éxito ✔️");

      setForm({
        name: "",
        description: "",
        priceBase: 0,
        priceVta: 0,
        companyId: form.companyId,
        subcategoryId: form.subcategoryId,
        inventory_id: form.inventory_id,
        quantity: 0,
        min_stock: 0,
      });
    } catch (error: any) {
      console.error(error);
      setMessage("❌ Error al crear el producto");
    }

    setLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow-lg rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      <div>
        <label className="block text-sm font-medium">Nombre</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2"
          placeholder="Ej: Remera Oversize Negra"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Precio Base</label>
        <input
          name="priceBase"
          type="number"
          value={form.priceBase}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2"
          placeholder="Ej: 8500"
          required
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-sm font-medium">Descripción</label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2"
          placeholder="Remera unisex de algodón premium, modelo oversize."
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Precio Venta</label>
        <input
          name="priceVta"
          type="number"
          value={form.priceVta}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2"
          placeholder="Ej: 12999"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Cantidad</label>
        <input
          name="quantity"
          type="number"
          value={form.quantity}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2"
          placeholder="Ej: 15"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Stock mínimo</label>
        <input
          name="min_stock"
          type="number"
          value={form.min_stock}
          onChange={handleChange}
          className="mt-1 w-full border border-gray-300 rounded-lg p-2"
          placeholder="Ej: 2"
        />
      </div>

      {/* IDs hardcodeadas temporalmente */}
      <div className="md:col-span-2 bg-gray-50 rounded-lg p-4 border text-sm text-gray-600">
        <p><strong>Company ID:</strong> {form.companyId}</p>
        <p><strong>Subcategory ID:</strong> {form.subcategoryId}</p>
        <p><strong>Inventory ID:</strong> {form.inventory_id}</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="md:col-span-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300"
      >
        {loading ? "Creando producto..." : "Crear Producto"}
      </button>

      {message && (
        <div className="md:col-span-2 text-center text-sm font-medium mt-2">
          {message}
        </div>
      )}
    </form>
  );
}
