"use client";

import { Card } from "@/components/ui/card";
import { StoreSwitcher } from "../selector/store-switcher";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  return (
    <Card className="mb-6 flex items-center flex-row justify-between rounded border-0 px-4 py-4">
      <h1 className="flex flex-row gap-5 tracking-tight text-foreground">
        <StoreSwitcher />
      </h1>

      {/* Botón a la derecha */}
      <div className="flex items-center">
        <Button
          variant="outline"
          onClick={() => router.push("/configuracion/tiendas")}
        >
          Administrar Tiendas
        </Button>
      </div>
    </Card>
  );
}
