"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { PAYWALL_ROUTE, postLoginRoute } from "@/lib/subscriptionGate";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

import { Input } from "../ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { API } from "@/lib/api";
import {
  getPartnerLoginStatus,
  type PartnerLoginStatus,
} from "@/features/partners/services/get-partner-login-status";
import ForgotPassword from "../modals/forgotPasswortModal";
import { Label } from "../ui/label";

interface LoginData {
  email: string;
  password: string;
}

interface LoginFormProps {
  onAuthenticated?: () => void;
}

async function resolveLoginPartnerStatus(accessToken: string): Promise<PartnerLoginStatus> {
  // Missing configuration cannot turn a relative /me response into confirmation.
  if (!API.partners) return "unknown";
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getPartnerLoginStatus(accessToken),
      new Promise<PartnerLoginStatus>((resolve) => {
        deadline = setTimeout(() => resolve("unknown"), 5_000);
      }),
    ]);
  } catch {
    // Auth succeeded: this optional lookup is not an invalid-password error.
    return "unknown";
  } finally {
    if (deadline !== undefined) clearTimeout(deadline);
  }
}

export default function LoginForm({ onAuthenticated }: LoginFormProps = {}) {
  const { login } = useAuth();
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

      // Un flujo que recupera sesión puede continuar en esta misma página.
      if (onAuthenticated) {
        onAuthenticated();
        return;
      }

      // Con empresa (dueño o staff) → dashboard. Sin empresa: con plan vigente →
      // crear empresa; sin plan → elegir y pagar plan (FEAT-11, lib/subscriptionGate).
      const destination = postLoginRoute(
        !!authResult.company || !!authResult.user?.companyId,
        authResult.subscription?.status,
      );
      if (destination === PAYWALL_ROUTE &&
          (await resolveLoginPartnerStatus(authResult.accessToken)) === "partner") {
        router.push("/partners");
        return;
      }
      router.push(destination);
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
      <form className="flex flex-col gap-5" onSubmit={handleOnLogin}>
        <div>
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            value={loginData.email}
            onChange={(e) =>
              setLoginData({ ...loginData, email: e.target.value })
            }
            id="email"
            type="email"
            placeholder="tu@negocio.com"
            required
            className={`mt-1.5 rounded-xl ${errors.email ? "border-red-400" : ""}`}
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email}</p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: "#4F3A96" }}
            >
              ¿Olvidaste tu contraseña?
            </button>
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
              className={`rounded-xl pr-10 ${errors.password ? "border-red-400" : ""}`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">{errors.password}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-70 mt-1"
          style={{ background: "#4F3A96" }}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Iniciando sesión...
            </>
          ) : (
            <>
              Ingresar <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <ForgotPassword open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
