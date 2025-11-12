"use client";
import axios from "axios";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import Label from "../ui/label";
import { Input } from "../ui/input";
import Link from "next/link";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import ForgotPassword from "../modals/forgotPasswortModal";

interface LoginData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [open, setOpen] = useState<boolean>(false);

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
    setIsLoading(true);
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Por favor, completa todos los campos requeridos.");
      return;
    }
    try {
      const response = await axios.post(
        "http://localhost:8080/api/v1/auth/login",
        loginData
      );
      if (response.status === 200) {
        login(response.data);
        router.push("/subscriptions");
      }
    } catch (error) {
      console.log(error);
      toast.error("El usuario y/o la contraseña son incorrectos");
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
              className="text-xs text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </p>
          </div>
          <Input
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
            id="password"
            type="password"
            placeholder="••••••••"
            required
            className={`${errors.password ? "border-red-500" : ""}`}
          />
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

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            O continúa con
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("google")}
          disabled={isLoading}
          className="w-full"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("facebook")}
          disabled={isLoading}
          className="w-full"
        >
          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Facebook
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("outlook")}
          disabled={isLoading}
          className="w-full"
        >
          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.59q0-.48.33-.8.33-.32.8-.32h14.38q.46 0 .8.33.32.33.32.8V12zm-6.5-5.13q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3V6.87zm0 2.5q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3V9.37zm0 2.5q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3v-1.13zm0 2.5q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3v-1.13z" />
          </svg>
          Outlook
        </Button>
      </div>
      <ForgotPassword open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
