"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import axios from "axios";
import { useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";

export default function RestablecerPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<{
    password: string;
    confirmPassword: string;
  }>({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState<boolean>(false);

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
    if (!token) {
      toast.error("El enlace de recuperación no es válido o ha expirado.");
      return;
    }
    setLoading(true);
    try {
      console.log({
        newPassword: data.password,
        token,
      });

      const response = await axios.post(
        "http://localhost:8080/api/v1/auth/reset-password",
        {
          token,
          newPassword: data.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.status === 200) {
        toast.success("Contraseña actualizada!", {
          description: "Hemos actualizado su contraseña correctamente",
        });
        setData({ confirmPassword: "", password: "" });
      }
    } catch (error) {
      toast.error(
        "Hemos tenido un error al actualizar su contraseña. Intentalo mas tarde."
      );
      console.log(error);
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
            {" "}
            {loading ? "Enviando..." : "Enviar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
