import { Card } from "@/components/ui/card";
import { StoreSwitcher } from "../selector/store-switcher";

interface Props {
  title: string;
}

export default function Header({ title }: Props) {
  return (
    <Card className="mb-6 flex items-center flex-row justify-between rounded border-0 px-4 py-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h1>

      {/* Store Switcher a la derecha */}
      <div className="flex items-center">
        <StoreSwitcher />
      </div>
    </Card>
  );
}
