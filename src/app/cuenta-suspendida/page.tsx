"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Personal de una empresa bloqueada por no migrar a Flow (FEAT-25). El gate de AuthGuard
 * trae acá al personal en BLOQUEADO y lo saca cuando la empresa vuelve a tener acceso.
 */
export default function CuentaSuspendidaPage() {
  const { auth, refreshSubscription, logout } = useAuth();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const companyName = auth?.company?.name;
  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await refreshSubscription();
    } finally {
      setRetrying(false);
    }
  };
  const signOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Cuenta suspendida</CardTitle>
          <CardDescription>
            {`La cuenta de ${companyName || "tu empresa"} está suspendida. Para volver a usar Powip, el dueño tiene que registrar su tarjeta o Yape.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button type="button" onClick={() => void retry()} disabled={retrying}>
            Volver a intentar
          </Button>
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
