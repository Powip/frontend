"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GATEWAY } from "@/lib/gateway";

export default function RestablecerClient() {
  const [tokens, setTokens] = useState<{
    accessToken: string | null;
    refreshToken: string | null;
  }>({ accessToken: null, refreshToken: null });

  useEffect(() => {
    // Supabase puts tokens in the hash fragment, not query params
    const hash = window.location.hash.substring(1); // remove leading '#'
    const params = new URLSearchParams(hash);
    setTokens({
      accessToken: params.get("access_token"),
      refreshToken: params.get("refresh_token"),
    });
  }, []);

  const [data, setData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);

  const validatePasswords = (): boolean => {
    const { password, confirmPassword } = data;

    if (!password.trim() || !confirmPassword.trim()) {
      toast.warning("Por favor, completá todos los campos.");
      return false;
    }

    if (password.length < 6) {
      toast.warning("La contraseña debe tener al menos 6 caracteres.");
      return false;
    }

    if (password !== confirmPassword) {
      toast.warning("Las contraseñas no coinciden.");
      return false;
    }

    return true;
  };

  const handleOnSend = async () => {
    if (!validatePasswords()) return;

    if (!tokens.accessToken || !tokens.refreshToken) {
      toast.error("El enlace de recuperación no es válido o ha expirado.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${GATEWAY.auth}/api/v1/auth/reset-password`,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          newPassword: data.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      toast.success("Contraseña actualizada!", {
        description: "Hemos actualizado su contraseña correctamente",
      });

      setData({ password: "", confirmPassword: "" });
    } catch (error) {
      toast.error(
        "Hemos tenido un error al actualizar su contraseña. Intentalo más tarde."
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-20">
      <Card>
        <CardHeader>Restablezca su contraseña</CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Contraseña</Label>
            <Input
              value={data.password}
              placeholder="*******"
              onChange={(e) => setData({ ...data, password: e.target.value })}
              type="password"
            />
          </div>

          <div>
            <Label>Confirmar contraseña</Label>
            <Input
              value={data.confirmPassword}
              placeholder="*******"
              onChange={(e) =>
                setData({ ...data, confirmPassword: e.target.value })
              }
              type="password"
            />
          </div>

          <Button
            onClick={handleOnSend}
            disabled={loading}
            className="w-full mt-4"
          >
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
