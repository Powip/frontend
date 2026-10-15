"use client";

import axios from "axios";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPartnerLoginStatus,
  type PartnerLoginStatus,
} from "@/features/partners/services/get-partner-login-status";
import { API } from "@/lib/api";
import { loginErrorMessage } from "@/lib/authErrors";
import { PAYWALL_ROUTE, postLoginRoute } from "@/lib/subscriptionGate";
import ForgotPassword from "../modals/forgotPasswortModal";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AuthErrorNotice, FieldError, notifyAuthError } from "./AuthFeedback";
import styles from "./auth-form.module.css";

interface LoginData {
  email: string;
  password: string;
}

function fieldError(field: keyof LoginData, value: string) {
  if (!value.trim()) {
    return field === "email" ? "Ingresa tu correo electrónico." : "Ingresa tu contraseña.";
  }
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return "Usa un correo válido, como tu@negocio.com.";
  }
  return undefined;
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
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocusRef = useRef<keyof LoginData | null>(null);
  const submittingRef = useRef(false);
  const [open, setOpen] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const field = pendingFocusRef.current;
    if (!field || !errors[field]) return;
    formRef.current
      ?.querySelector<HTMLInputElement>(`[name="${field}"]`)
      ?.focus({ preventScroll: true });
    pendingFocusRef.current = null;
  }, [errors]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    newErrors.email = fieldError("email", loginData.email);
    newErrors.password = fieldError("password", loginData.password);
    setErrors(newErrors);
    return newErrors;
  };

  const updateField = (field: keyof LoginData, value: string) => {
    setLoginData((previous) => ({ ...previous, [field]: value }));
    setServerError(null);
    setErrors((previous) =>
      previous[field] ? { ...previous, [field]: fieldError(field, value) } : previous,
    );
  };

  const showLoginError = (message: string) => {
    setServerError(message);
    notifyAuthError("No pudimos iniciar sesión", message);
  };

  const handleOnLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || submittingRef.current) return;
    setServerError(null);

    const newErrors = validateForm();
    const firstError = newErrors.email ? "email" : newErrors.password ? "password" : null;
    if (firstError) {
      notifyAuthError(
        "Revisa tus datos",
        newErrors[firstError] ?? "Completa los campos indicados.",
      );
      pendingFocusRef.current = firstError;
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);

    try {
      const response = await axios.post(
        "/api/auth/login",
        { ...loginData, email: loginData.email.trim() },
        { withCredentials: true }, // Cookie HttpOnly del mismo origen que la aplicación.
      );

      // login() retorna AuthData con company, subscription, etc.
      const authResult = await login(response.data);

      if (!authResult) {
        showLoginError("No pudimos cargar tu sesión. Intenta ingresar nuevamente.");
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
      if (
        destination === PAYWALL_ROUTE &&
        (await resolveLoginPartnerStatus(authResult.accessToken)) === "partner"
      ) {
        router.push("/partners");
        return;
      }
      router.push(destination);
    } catch (error: unknown) {
      showLoginError(loginErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form
        ref={formRef}
        className={styles.form}
        onSubmit={handleOnLogin}
        noValidate
        aria-busy={isLoading}
      >
        <div className={styles.field}>
          <Label htmlFor="email" className={styles.label}>
            Correo electrónico
          </Label>
          <Input
            value={loginData.email}
            onChange={(e) => updateField("email", e.target.value)}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@negocio.com"
            required
            disabled={isLoading}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            className={styles.input}
          />
          <FieldError id="login-email-error" message={errors.email} />
        </div>
        <div className={styles.field}>
          <Label htmlFor="password" className={styles.label}>
            Contraseña
          </Label>
          <div className={styles.password}>
            <Input
              value={loginData.password}
              onChange={(e) => updateField("password", e.target.value)}
              id="password"
              name="password"
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
          <FieldError id="login-password-error" message={errors.password} />
          <div className={styles.recovery}>
            <button type="button" onClick={() => setOpen(true)} className={styles.link}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>
        {serverError && <AuthErrorNotice title="No pudimos iniciar sesión" message={serverError} />}
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
