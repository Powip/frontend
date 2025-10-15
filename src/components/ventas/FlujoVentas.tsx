"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clientes } from "./Clientes";
import { Venta } from "./Venta";
import { Productos } from "./Productos";
import { Pago } from "./Pago";
import { toast } from "sonner";
import {
  IOrder,
  IOrderItem,
  ICreateOrderHeaderPlusItems,
} from "@/src/api/Interfaces";

interface Totals {
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
}

export default function FlujoVentas() {
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<IOrderItem[]>([]);
  const [totals, setTotals] = useState<Totals>({
    totalAmount: 0,
    totalVat: 0,
    totalShippingCost: 0,
  });

  const steps = ["Cliente", "Venta", "Productos", "Pago"];

  // ======================
  // Handlers del flujo
  // ======================
  const nextStep = () => {
    if (step === 1 && !customerId) {
      toast.error("Selecciona o crea un cliente antes de continuar");
      return;
    }
    if (step === 2 && !orderId) {
      toast.error("Crea una orden antes de continuar");
      return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length));
  };

  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleCustomerSaved = (id: string) => {
    setCustomerId(id);
    toast.success("Cliente guardado correctamente");
  };

  const handleOrderCreated = (order: IOrder) => {
    setOrderId(order.id);
    setTotals({
      totalAmount: order.total,
      totalVat: 0, // si tu backend lo maneja, podrías tomarlo de order
      totalShippingCost: 0,
    });
    toast.success("Orden creada correctamente");
  };

  const handleAddItem = (item: IOrderItem) => {
    setCartItems((prev) => [...prev, item]);
  };

  const handleUpdateTotals = (t: Totals) => setTotals(t);

  const handlePaymentCompleted = () => {
    toast.success("Pago registrado con éxito ✅");
    // Reiniciar flujo
    setStep(1);
    setCustomerId(null);
    setOrderId(null);
    setCartItems([]);
    setTotals({ totalAmount: 0, totalVat: 0, totalShippingCost: 0 });
  };

  // ======================
  // Variantes animación
  // ======================
  const variants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  return (
    <div className="w-full mx-auto min-h-max p-6 bg-white rounded-2xl shadow-lg">
      {/* Header del wizard */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          {steps.map((label, index) => (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                  step === index + 1
                    ? "bg-green text-white scale-110"
                    : step > index + 1
                    ? "bg-lime text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {index + 1}
              </div>
              <p
                className={`mt-1 text-xs font-medium ${
                  step === index + 1 ? "text-green" : "text-gray-500"
                }`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Barra de progreso */}
        <div className="relative h-2 bg-gray-200 rounded-full">
          <motion.div
            className="absolute top-0 left-0 h-full bg-green rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Contenido del paso */}
      <div className="h-[1000px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="absolute w-full"
          >
            {step === 1 && <Clientes next={handleCustomerSaved} />}
            {step === 2 && customerId && (
              <Venta
                prev={prevStep}
                next={handleOrderCreated}
                customerId={customerId}
              />
            )}
            {step === 3 && orderId && (
              <Productos
                prev={prevStep}
                next={nextStep}
                orderId={orderId}
                cartItems={cartItems}
                onAddItem={handleAddItem}
                onUpdateTotals={handleUpdateTotals}
              />
            )}
            {step === 4 && orderId && (
              <Pago
                prev={prevStep}
                orderId={orderId}
                totals={totals}
                onPaymentCompleted={handlePaymentCompleted}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controles globales de navegación */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={prevStep}
          disabled={step === 1}
          className={`px-4 py-2 rounded-xl font-medium transition ${
            step === 1
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          ← Anterior
        </button>

        {step < steps.length ? (
          <button
            onClick={nextStep}
            className="px-6 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-sm transition"
          >
            Siguiente →
          </button>
        ) : (
          <button
            onClick={handlePaymentCompleted}
            className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm transition"
          >
            Finalizar venta
          </button>
        )}
      </div>
    </div>
  );
}
