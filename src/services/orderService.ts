import pedidos from "../mocks/pedidos";
import { IOrder } from "@/src/interfaces/IOrder";

// Servicio para traer un pedido
export async function getPedidos(): Promise<IOrder[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(pedidos), 500);
  });
}

// Sevicio para traer un pedido por Id
export const getPedidoById = async (id: string): Promise<IOrder> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const pedido = pedidos.find((p) => p.id === id);
      resolve(
        pedido || {
          id: "",
          dateVta: "",
          dateEntrega: "",
          status: "",
          tag: "",
          estadoPago: "",
          telefono: "",
          cliente: "",
          vendedor: "",
          courier: "",
          direccion: "",
          distrito: "",
          provincia: "",
          entrega: "",
          datosEntrega: "",
          contactoAdicional: "",
          telefonoAdicional: "",
          canalVenta: "",
          impTotal: 0,
          impPendiente: 0,
          claveRecojo: "",
          trakking: "",
          agente: "",
        }
      );
    }, 500);
  });
};
