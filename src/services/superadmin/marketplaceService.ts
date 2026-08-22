import { IAppMarketplace } from "@/interfaces/superadmin";
import { appsMarketplaceMock } from "@/mocks/superadmin";
import { mockDelay } from "./shared";

export async function getApps(): Promise<IAppMarketplace[]> {
  return mockDelay([...appsMarketplaceMock]);
}

export async function getKpisMarketplace() {
  const total = appsMarketplaceMock.length;
  const publicadas = appsMarketplaceMock.filter((a) => a.estado === "publicada").length;
  const pendientes = appsMarketplaceMock.filter((a) => a.estado === "pendiente").length;
  const instalacionesTotales = appsMarketplaceMock.reduce((sum, a) => sum + a.instalacionesCount, 0);
  return mockDelay({ total, publicadas, pendientes, instalacionesTotales });
}

export async function getAppsPendientes(): Promise<IAppMarketplace[]> {
  return mockDelay(appsMarketplaceMock.filter((a) => a.estado === "pendiente"));
}

export async function aprobarApp(id: string): Promise<IAppMarketplace | null> {
  const app = appsMarketplaceMock.find((a) => a.id === id);
  if (!app) return mockDelay(null);
  app.estado = "publicada";
  return mockDelay(app, 350);
}

export async function rechazarApp(id: string): Promise<IAppMarketplace | null> {
  const app = appsMarketplaceMock.find((a) => a.id === id);
  if (!app) return mockDelay(null);
  app.estado = "rechazada";
  return mockDelay(app, 350);
}
