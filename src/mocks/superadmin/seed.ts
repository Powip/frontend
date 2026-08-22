/* -----------------------------------------------------------------------
   Semillas compartidas entre los mocks de /superadmin — nombres de negocio,
   personas y helpers, para que los mismos negocios/personas aparezcan de
   forma coherente en Empresas, Leads, Tickets, Partners, etc.
------------------------------------------------------------------------ */

export const NEGOCIOS = [
  { nombre: "Bella Piel Cosmética", rubro: "Cosmética", iniciales: "BP", color: "bg-pink-500" },
  { nombre: "Andina Sport", rubro: "Ropa deportiva", iniciales: "AS", color: "bg-blue-500" },
  { nombre: "Kids Land Perú", rubro: "Ropa infantil", iniciales: "KL", color: "bg-amber-500" },
  { nombre: "TecnoHogar Express", rubro: "Electrodomésticos", iniciales: "TH", color: "bg-violet-500" },
  { nombre: "Joyas del Sol", rubro: "Bisutería", iniciales: "JS", color: "bg-yellow-500" },
  { nombre: "Mundo Mascota PE", rubro: "Mascotas", iniciales: "MM", color: "bg-emerald-500" },
  { nombre: "Ropa Urbana Lima", rubro: "Ropa", iniciales: "RU", color: "bg-slate-500" },
  { nombre: "Nutri Vida Suplementos", rubro: "Suplementos", iniciales: "NV", color: "bg-green-600" },
  { nombre: "Zapatillas Norte", rubro: "Calzado", iniciales: "ZN", color: "bg-red-500" },
  { nombre: "Belleza Total Store", rubro: "Cosmética", iniciales: "BT", color: "bg-fuchsia-500" },
  { nombre: "Casa & Deco Perú", rubro: "Hogar", iniciales: "CD", color: "bg-orange-500" },
  { nombre: "Tech Gadgets 24", rubro: "Tecnología", iniciales: "TG", color: "bg-cyan-600" },
  { nombre: "Moda Chalaca", rubro: "Ropa", iniciales: "MC", color: "bg-indigo-500" },
  { nombre: "Lentes Express Perú", rubro: "Accesorios", iniciales: "LE", color: "bg-teal-600" },
  { nombre: "Baby Shop Lima", rubro: "Bebés", iniciales: "BS", color: "bg-rose-500" },
  { nombre: "Fit Nutrition PE", rubro: "Suplementos", iniciales: "FN", color: "bg-lime-600" },
  { nombre: "Relojería Andina", rubro: "Accesorios", iniciales: "RA", color: "bg-stone-500" },
  { nombre: "Distribuidora Arequipa Sur", rubro: "Multicategoría", iniciales: "DA", color: "bg-sky-600" },
  { nombre: "Cocina Fácil Perú", rubro: "Hogar", iniciales: "CF", color: "bg-amber-600" },
  { nombre: "Piscinas & Jardín PE", rubro: "Hogar", iniciales: "PJ", color: "bg-blue-600" },
  { nombre: "Trujillo Fashion Store", rubro: "Ropa", iniciales: "TF", color: "bg-purple-500" },
  { nombre: "Vape Shop Perú", rubro: "Otros", iniciales: "VS", color: "bg-gray-500" },
  { nombre: "Cusco Artesanal Export", rubro: "Artesanía", iniciales: "CA", color: "bg-red-600" },
  { nombre: "Bike Store Lima", rubro: "Deportes", iniciales: "BK", color: "bg-emerald-600" },
] as const;

export const PERSONAS = [
  "María Fernanda Quispe", "Jorge Luis Ramírez", "Andrea Vásquez", "Carlos Mendoza",
  "Lucía Torres", "Diego Salazar", "Valentina Rojas", "Renato Chávez",
  "Camila Espinoza", "Sebastián Flores", "Daniela Castro", "Martín Huamán",
  "Fiorella Paredes", "Gabriel Núñez", "Ximena Delgado", "Rodrigo Aguilar",
  "Milagros Cárdenas", "Álvaro Vega", "Paola Sánchez", "Eduardo Ríos",
];

export const SDRS = [
  { id: "sdr-1", nombre: "Heidy Medina" },
  { id: "sdr-2", nombre: "Marcela Guerrero" },
  { id: "sdr-3", nombre: "Fabrizio León" },
  { id: "sdr-4", nombre: "Rosario Campos" },
];

export const COURIERS = ["Shalom", "Olva Courier", "Marvisur", "Cruz del Sur Cargo", "Chazki"];

let seedCounter = 1;
export function nextId(prefix: string): string {
  seedCounter += 1;
  return `${prefix}-${String(seedCounter).padStart(4, "0")}`;
}

export function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length];
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function hoursAgoISO(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

export function minutesAgoISO(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

export function daysFromNowISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function money(seedValue: number, min: number, max: number): number {
  const span = max - min;
  const pseudo = Math.abs(Math.sin(seedValue) * 10000) % 1;
  return Math.round((min + pseudo * span) * 100) / 100;
}
