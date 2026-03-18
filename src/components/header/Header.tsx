"use client";

import { StoreSwitcher } from "../selector/store-switcher";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

export default function Header() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between px-8 py-3 bg-background border-b border-border shadow-sm">
      <div className="flex items-center gap-4">
        <StoreSwitcher />
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/20 hover:bg-primary/5 hover:border-primary/50 transition-all font-medium"
          onClick={() => router.push("/configuracion/tiendas")}
        >
          <Settings className="h-4 w-4" />
          Administrar Tiendas
        </Button>
      </div>
    </div>
  );
}
