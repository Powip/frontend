"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, Target, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CodTab() {
  const router = useRouter();

  return (
    <div className="p-6">
      <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/10 dark:to-fuchsia-500/10 p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white mb-4">
          <Target className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-violet-700 dark:text-violet-300 mb-1.5">Gestión COD</h3>
        <p className="text-xs text-violet-600/80 dark:text-violet-400/80 max-w-md mx-auto mb-6">
          Panel especializado con aging heatmap, canal de origen, intentos de contacto y upsell por agente,
          disponible en el módulo de Atención al Cliente.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="gap-2 bg-card"
            onClick={() => router.push("/atencion-cliente")}
          >
            <MessageCircle className="h-4 w-4 text-violet-500" />
            Vista Social (WA · IG · TikTok)
          </Button>
          <Button
            variant="outline"
            className="gap-2 bg-card"
            onClick={() => router.push("/atencion-cliente")}
          >
            <Globe className="h-4 w-4 text-violet-500" />
            Vista Integral (WA · Web COD)
          </Button>
        </div>
      </div>
    </div>
  );
}
