import { NivelLog } from "@/interfaces/superadmin";
import { logsSistemaMock } from "@/mocks/superadmin";
import { mockDelay } from "./shared";

export async function getLogs(nivel?: NivelLog | "todos") {
  let items = [...logsSistemaMock];
  if (nivel && nivel !== "todos") items = items.filter((l) => l.nivel === nivel);
  return mockDelay(items.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()));
}

export async function getKpisLogs() {
  const total = logsSistemaMock.length;
  const info = logsSistemaMock.filter((l) => l.nivel === "info").length;
  const warn = logsSistemaMock.filter((l) => l.nivel === "warn").length;
  const error = logsSistemaMock.filter((l) => l.nivel === "error").length;
  return mockDelay({ total, info, warn, error });
}
