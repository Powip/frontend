"use client";
import axios from "axios";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import ForgotPassword from "../modals/forgotPasswortModal";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import styles from "./auth-form.module.css";

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
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
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

      // 1️⃣ Si tiene compañía (dueño o staff), va al dashboard
      if (authResult.company) {
        router.push("/");
        return;
      }

      // 2️⃣ Si NO tiene compañía, verificar suscripción para permitir crear una
      if (!authResult.subscription || authResult.subscription.status !== "ACTIVE") {
        router.push("/subscriptions");
        return;
      }

      // 3️⃣ Tiene suscripción activa pero no compañía -> Crear compañía
      router.push("/new-company");
    } catch (error: any) {
      console.error("Login Error:", error.response?.data || error.message);
      const errorMessage =
        error.response?.data?.message || "El usuario y/o la contraseña son incorrectos";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form className={styles.form} onSubmit={handleOnLogin} noValidate>
        <div className={styles.field}>
          <Label htmlFor="email" className={styles.label}>
            Correo electrónico
          </Label>
          <Input
            value={loginData.email}
            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@negocio.com"
            required
            disabled={isLoading}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className={styles.input}
          />
          {errors.email && (
            <p id="login-email-error" className={styles.error}>
              {errors.email}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <Label htmlFor="password" className={styles.label}>
            Contraseña
          </Label>
          <div className={styles.password}>
            <Input
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={isLoading}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              className={styles.passwordInput}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className={styles.error}>
              {errors.password}
            </p>
          )}
          <div className={styles.recovery}>
            <button type="button" onClick={() => setOpen(true)} className={styles.link}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
        <button type="submit" disabled={isLoading} className={styles.submit}>
          {isLoading ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Iniciando sesión...
            </>
          ) : (
            <>
              Ingresar <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <ForgotPassword open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
