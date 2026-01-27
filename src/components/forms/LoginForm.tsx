"use client";
import axios from "axios";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "../ui/input";
import Link from "next/link";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import ForgotPassword from "../modals/forgotPasswortModal";
import { Label } from "../ui/label";

interface LoginData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const { auth, login, inventories } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [open, setOpen] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSocialLogin = (provider: string) => {
    console.log(`[v0] Logging in with ${provider}`);
    // Handle social login
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (loginData.email.trim() === "") {
      newErrors.email = "El correo electrónico es obligatorio";
    }
    if (loginData.password.trim() === "") {
      newErrors.password = "La contraseña es obligatoria";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleOnLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!validateForm()) {
      toast.error("Por favor, completa todos los campos requeridos.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_USERS}/auth/login`,
        loginData,
        { withCredentials: true }, // Para recibir httpOnly cookie
      );

      // login() retorna AuthData con company, subscription, etc.
      const authResult = await login(response.data);

      if (!authResult) {
        toast.error("Error procesando la sesión del usuario.");
        return;
      }

      // 1️⃣ Si tiene compañía (dueño o staff), va al dashboard
      if (authResult.company) {
        router.push("/");
        return;
      }

      // 2️⃣ Si NO tiene compañía, verificar suscripción para permitir crear una
      if (
        !authResult.subscription ||
        authResult.subscription.status !== "ACTIVE"
      ) {
        router.push("/subscriptions");
        return;
      }

      // 3️⃣ Tiene suscripción activa pero no compañía -> Crear compañía
      router.push("/new-company");
    } catch (error: any) {
      console.error("Login Error:", error.response?.data || error.message);
      const errorMessage =
        error.response?.data?.message ||
        "El usuario y/o la contraseña son incorrectos";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            value={loginData.email}
            onChange={(e) =>
              setLoginData({ ...loginData, email: e.target.value })
            }
            id="email"
            type="email"
            placeholder="tu@email.com"
            required
            className={`${errors.email ? "border-red-500" : ""}`}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <p
              onClick={() => {
                setOpen(true);
              }}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              ¿Olvidaste tu contraseña?
            </p>
          </div>
          <div className="relative">
            <Input
              value={loginData.password}
              onChange={(e) =>
                setLoginData({ ...loginData, password: e.target.value })
              }
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              className={`pr-10 ${errors.password ? "border-red-500" : ""}`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password}</p>
          )}
        </div>
        <Button
          type="submit"
          onClick={(e) => handleOnLogin(e)}
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
        </Button>
      </form>

      <ForgotPassword open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
