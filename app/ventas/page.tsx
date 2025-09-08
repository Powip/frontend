import { AgregarProducto } from "@/src/ventas/agregar-producto-component";
import { FichaCliente } from "@/src/ventas/ficha-cliente";
import { PagoComponent } from "@/src/ventas/pago-component";
import { ProductosComponent } from "@/src/ventas/productos-component";
import { Venta } from "@/src/ventas/venta";

export default function Ventas() {
  return (
    <div className="flex flex-col items-center justify-center">
     <FichaCliente/>
     <Venta/>
     <ProductosComponent/>
     <AgregarProducto/>
     <PagoComponent/>
    </div>
  );
}