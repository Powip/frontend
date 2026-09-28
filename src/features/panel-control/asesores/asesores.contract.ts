import { defineContract, ROLES_GESTION } from "../shared/data/contract-helpers";

export const OPCIONES_ASESORES_CONTRACT = defineContract({
  id: "opciones-asesores",
  titulo: "Opciones del filtro Asesor(a)",
  metodo: "GET",
  endpoint: "/atencion-al-cliente/agentes/vendedores?companyId=",
  endpointActual: "/atencion-al-cliente/agentes/vendedores?companyId= (ms-ventas)",
  estado: "conectado",
  pantallas: ["resumen", "canales", "callcenter", "operaciones", "equipo"],
  filtros: [],
  roles: ROLES_GESTION,
  capacidadRequerida: "elegir_asesor",
  respuesta: "AsesorOpcion[]",
  pendientes: [
    "Confirmar si la lista incluye confirmadoras (ccAgenteId) además de vendedoras (sellerId)",
    "El filtro asesor=… debe comparar contra sellerId o ccAgenteId según la entrada del canal; el valor sin_asesor filtra pedidos automáticos",
  ],
});
