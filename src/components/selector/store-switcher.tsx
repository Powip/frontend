import { useState } from "react";
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

interface Store {
  id: string;
  name: string;
  logo?: string | null;
}
export function StoreSwitcher() {
  const [stores] = useState<Store[]>([
    { id: "1", name: "Tienda Principal", logo: null },
    { id: "2", name: "Tienda Online", logo: null },
    { id: "3", name: "Tienda Física", logo: null },
  ]);

  const [currentStore, setCurrentStore] = useState<Store>(stores[0]);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors border border-input">
          {currentStore.logo ? (
            <Image
              src={currentStore.logo}
              alt={currentStore.name}
              width={24}
              height={24}
              className="rounded-md"
            />
          ) : (
            <UserRound className="w-6 h-6 text-muted-foreground" />
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground">
              {currentStore.name}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Activa
            </span>
          </div>

          <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-52 rounded-md p-1" // <-- padding general + bordes suaves
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground px-2 py-1.5">
          Seleccionar Tienda
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {stores.map((store) => (
          <DropdownMenuItem
            key={store.id}
            onClick={() => {
              setCurrentStore(store);
              setIsOpen(false);
            }}
            className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md"
          >
            {store.logo ? (
              <Image
                src={store.logo}
                alt={store.name}
                width={20}
                height={20}
                className="rounded-sm"
              />
            ) : (
              <UserRound className="w-5 h-5 text-muted-foreground" />
            )}

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
