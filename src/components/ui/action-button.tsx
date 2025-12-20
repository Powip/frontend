"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ActionButtonProps {
  label: string; // Texto cuando NO está cargando
  loadingLabel?: string; // Texto mientras está cargando
  onClick: () => Promise<void>; // Acción asincrónica
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  icon?: React.ReactNode; // Ícono opcional (ej: <Plus />)
}

export default function ActionButton({
  label,
  loadingLabel,
  onClick,
  variant = "default",
  size = "default",
  icon,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="default"
      size={size}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {loadingLabel || "Procesando..."}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {label}
        </>
      )}
    </Button>
  );
}
