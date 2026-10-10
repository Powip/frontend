"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import type { AdvertisingProviderWire } from "@/services/advertisingService";
import {
  advertisingErrorMessage,
  completeAdvertisingAuthorization,
} from "@/services/advertisingService";

interface CallbackParameters {
  provider: AdvertisingProviderWire | null;
  state: string | null;
  code: string | null;
  error: string | null;
}

export default function AdvertisingCallbackPage() {
  const router = useRouter();
  const { auth, loading } = useAuth();
  const captured = useRef<CallbackParameters | null>(null);
  const attempted = useRef(false);
  const mounted = useRef(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentScope = useRef("");
  currentScope.current = `${auth?.user.id}:${auth?.company?.id}`;

  useEffect(() => {
    mounted.current = true;
    if (!captured.current) {
      const url = new URL(window.location.href);
      const unique = (key: string) =>
        url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) : null;
      const rawProvider = unique("provider");
      const provider = rawProvider === "meta" || rawProvider === "tiktok" ? rawProvider : null;
      const codeName = provider === "tiktok" ? "auth_code" : "code";
      captured.current = {
        provider,
        state: unique("state"),
        code: unique(codeName),
        error: url.searchParams.has("error") ? "Conexión cancelada." : null,
      };
      // Keep the code/state only in memory and remove them before any API call.
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${provider ? `?provider=${provider}` : ""}`,
      );
    }
    setReady(true);
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || loading || attempted.current || !captured.current) return;
    const parameters = captured.current;
    if (parameters.error) {
      setError(parameters.error);
      return;
    }
    if (!parameters.provider || !parameters.code || !parameters.state) {
      setError("No pudimos completar la conexión. Vuelve a iniciarla.");
      return;
    }
    if (!auth?.accessToken || !auth.company?.id) {
      setError("Inicia sesión y vuelve a conectar la cuenta.");
      return;
    }
    attempted.current = true;
    const scope = `${auth.user.id}:${auth.company.id}`;
    completeAdvertisingAuthorization(auth.accessToken, auth.company.id, parameters.provider, {
      state: parameters.state,
      code: parameters.code,
    })
      .then(() => {
        if (!mounted.current) return;
        if (currentScope.current !== scope) {
          setError("La sesión cambió. Vuelve a conectar la cuenta.");
          return;
        }
        router.replace(`/configuracion/integraciones/publicidad?connected=${parameters.provider}`);
      })
      .catch((failure: unknown) => {
        if (mounted.current) setError(advertisingErrorMessage(failure));
      });
  }, [ready, loading, auth, router]);

  return (
    <main className="mx-auto min-w-0 max-w-xl p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conectar publicidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              Completando la conexión…
            </p>
          )}
          {error && (
            <Button variant="outline" asChild>
              <Link href="/configuracion/integraciones/publicidad">Volver a publicidad</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
