import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { IProduct } from "../interfaces";

export function exportProductsToExcel(products: IProduct[]) {
  if (!products || products.length === 0) {
    alert("No hay productos para exportar");
    return;
  }

  const data = products.map((p) => ({
    Código: p.sku,
    Descripción: p.description,
    Precio: p.priceBase,
    Marca: p.brand?.name || "",
    Proveedor: p.company?.name || "",
    Subcategoría: p.subcategory?.name || "",
    Categoría: p.category?.name || "",
  }));

  // Creamcion de hoja de cálculo
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");

  // creacion de archivo xlsx
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, `productos_${new Date().toISOString().split("T")[0]}.xlsx`);
}
