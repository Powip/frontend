"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, Shield, Zap, Users } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import ForgotPassword from "@/components/modals/forgotPasswortModal";
import Image from "next/image";
import { GATEWAY } from "@/lib/gateway";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (loginData.email.trim() === "")
      newErrors.email = "El correo electrónico es obligatorio";
    if (loginData.password.trim() === "")
      newErrors.password = "La contraseña es obligatoria";
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
        `${GATEWAY.auth}/api/v1/auth/login`,
        loginData,
        { withCredentials: true },
      );
      const authResult = await login(response.data);
      if (!authResult) {
        toast.error("Error procesando la sesión del usuario.");
        return;
      }
      if (authResult.company === null) {
        router.push("/new-company");
        return;
      }
      // TEMPORAL: restricción de suscripción deshabilitada
      if (!authResult.subscription) {
        router.push("/sin-plan");
        return;
      }
      router.push("/dashboard");
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      const errorMessage =
        axiosError.response?.data?.message ||
        "El usuario y/o la contraseña son incorrectos";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className="min-h-screen flex flex-col lg:grid lg:grid-cols-2"
        style={{ background: "#f7f5ff" }}
      >
      {/* Mobile Header */}
  <div className="lg:hidden bg-[#4F3A96] px-4 py-2">
    <div className="flex items-center gap-3">
      <Image
        src="/logo-powip-text.svg"
        alt="Powip"
        width={100}
        height={40}
        className="h-auto brightness-0 invert"
        priority
      />
    </div>
    </div>

 {/* Brand panel — desktop only */}
<div
  className="hidden lg:flex flex-col px-10 py-12 h-screen relative overflow-hidden"
  style={{
    background:
      "linear-gradient(160deg, #3d2d78 0%, #4F3A96 55%, #6a4fc4 100%)",
  }}
>
  {/* Decorative circles */}
  <div
    className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10"
    style={{ background: "rgba(255,255,255,0.3)" }}
  />

  <div
    className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full opacity-10"
    style={{ background: "rgba(255,255,255,0.2)" }}
  />

  {/* Logo */}
  <div className="flex justify-start items-center w-full z-10">
    <Image
      src="/logo-powip-text.svg"
      alt="Logo Powip"
      width={320}
      height={100}
      priority
      className="w-auto h-10 brightness-0 invert"
    />
  </div>

  {/* Content */}
  <div className="mt-12 flex flex-col gap-8 z-10">
    <div>
      <h2 className="text-white font-black text-4xl leading-tight mb-4">
        Bienvenido de vuelta
      </h2>

      <p className="text-white/70 text-base leading-relaxed max-w-md">
        Gestiona tus pedidos, inventario y couriers desde un solo panel.
      </p>
    </div>

    <div className="flex flex-col gap-3">
      {[
        { icon: Shield, text: "Conexión segura SSL" },
        { icon: Zap, text: "Acceso inmediato a tu panel" },
        { icon: Users, text: "+1,200 negocios confían en Powip" },
      ].map(({ icon: Icon, text }) => (
        <div key={text} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-white/80" />
          </div>

          <span className="text-white/75 text-sm">
            {text}
          </span>
        </div>
      ))}
    </div>
  </div>

  {/* Mascota */}
  <Image
    src="/mascota-saludando.svg"
    alt=""
    aria-hidden="true"
    width={800}
    height={800}
    priority
    className="absolute -bottom-[100px] right-0 w-[500px] h-auto pointer-events-none select-none"
  />
</div>

        {/* Form panel */}
        <div className="flex flex-col items-center justify-center px-5 py-12 bg-transparent">
          <div className="w-full max-w-xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-black text-gray-900">
                Iniciar sesión
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Ingresa tus credenciales para continuar.
              </p>
            </div>

            {/* Form card */}
            <div
              className="p-6 sm:p-8 "
              style={{ borderColor: "rgba(79,58,150,0.08)" }}
            >
              <form onSubmit={handleOnLogin} className="flex flex-col gap-5">
                {/* Email */}
                <div>
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@negocio.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    className={`mt-1.5 ${errors.email ? "border-red-400" : ""}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Password */}
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
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      className={`pr-10 ${errors.password ? "border-red-400" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Submit */}
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
            </div>

            {/* Register link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                ¿No tienes cuenta?{" "}
                <Link
                  href="https://powip.lat"
                  className="font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: "#4F3A96" }}
                >
                  Regístrate en Powip →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <ForgotPassword open={open} onClose={() => setOpen(false)} />
    </>
  );
}
