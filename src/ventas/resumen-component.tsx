import React from "react"
import ModalContainer from "../components/ui/modal-container"

export default function ResumenCompra() {
  return (
    <ModalContainer>
      <div className="grid grid-cols-2 gap-y-2 border-b pb-2">
        <span>Productos</span>
        <span className="text-right">$100.00</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 border-b py-2">
        <span>IVG 18%</span>
        <span className="text-right">$10.00</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 border-b py-2">
        <span>Envío</span>
        <span className="text-right">$0.00</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 border-b py-2">
        <span className="text-red-500">Descuentos</span>
        <span className="text-right text-red-500">- $20.00</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 border-b py-2">
        <span className="text-red-500">Adelanto</span>
        <span className="text-right text-red-500">$0.00</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 border-b py-2">
        <span>Por cobrar</span>
        <span className="text-right">$100.00</span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 pt-4 text-lg font-semibold">
        <span>Total</span>
        <span className="text-right">$100.00</span>
      </div>
    </ModalContainer>
  )
}
