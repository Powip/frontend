"use client";
import { FichaCliente } from "@/src/components/ventas/ficha-cliente";
import { PagoComponent } from "@/src/components/ventas/pago-component";
import { ProductosComponent } from "@/src/components/ventas/productos-component";
import { Venta } from "@/src/components/ventas/venta";
import { useState } from "react";

export default function Ventas() {
  const [index, setIndex] = useState(0);

  const prev = () => {
    setIndex((prevIndex) =>
      prevIndex === 0 ? forms.length - 1 : prevIndex - 1
    );
  };
  const next = () => {
    setIndex((prevIndex) =>
      prevIndex === forms.length - 1 ? 0 : prevIndex + 1
    );
  };

  const forms = [
    <FichaCliente key="ficha-cliente" next={next} />,
    <Venta key="venta" next={next} prev={prev} />,
    <ProductosComponent key="productos-component" next={next} prev={prev} />,
    <PagoComponent key="pago-component" prev={prev} />,
  ];

  return (
    <div>
      <div className="flex items-center justify-center ">{forms[index]}</div>
    </div>
  );
}
