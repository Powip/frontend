import { Card } from "@/components/ui/card";
import { StoreSwitcher } from "../selector/store-switcher";
import { Button } from "../ui/button";

export default function Header() {
  return (
    <Card className="mb-6 flex items-center flex-row justify-between rounded border-0 px-4 py-4">
      <h1 className="flex flex-row gap-5  tracking-tight text-foreground">
        <StoreSwitcher />
      </h1>

      {/* Store Switcher a la derecha */}

      <div className="flex items-center">
        <Button variant={"outline"}>Administrar Tiendas</Button>
      </div>
    </Card>
  );
}
