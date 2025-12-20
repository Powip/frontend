"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import Image from "next/image";
import { ChevronDown, MapPin } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@radix-ui/react-dropdown-menu";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface Store {
  id: string;
  name: string;
  logo?: string | null;
}
export function StoreSwitcher() {
  const { auth, selectedStoreId, setSelectedStore } = useAuth();

  const stores = useMemo(
    () => auth?.company?.stores ?? [],
    [auth?.company?.stores]
  );

  const currentStore =
    stores.find((s) => s.id === selectedStoreId) || stores[0];

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStore(stores[0].id);
    }
  }, [stores, selectedStoreId, setSelectedStore]);

  if (stores.length === 0) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors border border-input">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground">
              {currentStore.name}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              Activa
            </span>
          </div>

          <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52 rounded-md p-1">
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
          Seleccionar Tienda
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => {
              setSelectedStore(store.id);
              setIsOpen(false);
            }}
            className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md"
          >
            <div className="flex-1">
              <p className="text-sm">{store.name}</p>
            </div>

            {currentStore.id === store.id && (
              <div className="h-2 w-2 rounded-full bg-teal-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
