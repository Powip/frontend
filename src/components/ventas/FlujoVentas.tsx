"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clientes } from "./Clientes";
import { Venta } from "./venta";
import { Productos } from "./Productos";
import { Pago } from "./Pago";
import { toast } from "sonner";
import { IAddItem, ICreateOrderHeader, IOrder } from "@/src/api/Interfaces";
import { Button } from "@/src/components/ui/button";

interface Totals {
  totalAmount: number;
  totalVat: number;
  totalShippingCost: number;
}

interface Item {
  unitPrice: number;
  quantity: number;
}

export default function FlujoVentas() {
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState<string | null | undefined>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<IAddItem[]>([]);
  const [totals, setTotals] = useState<Totals>({
    totalAmount: 0,
    totalVat: 0,
    totalShippingCost: 0,
  });

  const steps = ["Cliente", "Venta", "Productos", "Pago"];

  const nextStep = () => setStep((prev) => Math.min(prev + 1, steps.length));
  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleCustomerSaved = (id: string) => {
    setCustomerId(id);
    toast.success("Cliente guardado correctamente");
  };

  const handleOrderUpdated = (id: string) => {
    setOrderId(id);
    console.log("ID de orden actualizada desde Productos:", id);
  };

  const handleOrderCreated = (order: ICreateOrderHeader) => {
    setOrderId(order.id || null);
    console.log("Order ID creado:", order.id);
    setTotals({
      totalAmount: order.totalAmount,
      totalVat: order.totalVat,
      totalShippingCost: order.totalShippingCost,
    });
    setCartItems([]);
    toast.success("Orden creada correctamente");
    nextStep();
  };

  const handleAddItem = (item: IAddItem, it: Item) => {
    setCartItems((prev) => {
      const updated = [...prev, item];
      const totalAmount = updated.reduce(
        (acc, it) => acc + Number(it.unitPrice) * Number(it.quantity),
        0
      );
      setTotals({
        totalAmount,
        totalVat: totalAmount * 0.18,
        totalShippingCost: 0,
      });
      return updated;
    });
  };

  const handleUpdateTotals = (t: Totals) => setTotals(t);

  const handlePaymentCompleted = () => {
    toast.success("Pago registrado con éxito ✅");
    setStep(1);
    setCustomerId(null);
    setOrderId(null);
    setCartItems([]);
    setTotals({ totalAmount: 0, totalVat: 0, totalShippingCost: 0 });
    localStorage.removeItem("currentOrder");
  };

  const variants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-h-min p-6 bg-white rounded-2xl shadow-lg">
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

        <div className="relative h-2 bg-gray-200 rounded-full">
          <motion.div
            className="absolute top-0 left-0 h-full bg-green rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="w-full"
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
                onOrderUpdated={handleOrderUpdated}
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

      <div className="grid grid-cols-4 gap-15 w-full">
        <Button
          onClick={prevStep}
          disabled={step === 1}
          variant="outline"
          className="border-sky-blue text-sky-blue col-span-1"
        >
          Regresar
        </Button>

        {step < steps.length ? (
          <Button
            onClick={nextStep}
            className="col-span-3"
            disabled={
              (step === 1 && !customerId) || // Clientes
              (step === 2 && !orderId) || // Venta
              (step === 3 && cartItems.length === 0) // Productos
            }
          >
            Siguiente
          </Button>
        ) : (
          <button
            onClick={handlePaymentCompleted}
            className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm transition col-span-3"
          >
            Finalizar venta
          </button>
        )}
      </div>
    </div>
  );
}
