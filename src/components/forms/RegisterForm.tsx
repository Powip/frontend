"use client";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RegisterData } from "@/hooks/useOnboardingFlow";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import styles from "./auth-form.module.css";

type RegisterFormData = RegisterData & { confirmPassword: string };

interface RegisterFormProps {
  isLoading: boolean;
  error: string | null;
  onNext: (data: RegisterData) => Promise<void>;
}

const REGISTER_STEPS: { label: string; shortLabel: string; fields: (keyof RegisterFormData)[] }[] =
  [
    {
      label: "Datos personales",
      shortLabel: "Datos",
      fields: ["name", "surname", "identityDocument", "phone"],
    },
    {
      label: "Ubicación",
      shortLabel: "Ubicación",
      fields: ["district", "address"],
    },
    {
      label: "Acceso a tu cuenta",
      shortLabel: "Cuenta",
      fields: ["email", "password", "confirmPassword"],
    },
  ];

export default function RegisterForm({ isLoading, error, onNext }: RegisterFormProps) {
  const submittingRef = useRef(false);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const stepTitleRef = useRef<HTMLLegendElement>(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      stepTitleRef.current?.focus({ preventScroll: true });
      previousStepRef.current = step;
    }
  }, [step]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [registerData, setRegisterData] = useState<RegisterFormData>({
    name: "",
    surname: "",
    phone: "",
    identityDocument: "",
    email: "",
    password: "",
    confirmPassword: "",
    district: "",
    address: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});

  const validateFields = (fields: (keyof RegisterFormData)[]) => {
    const newErrors: Partial<Record<keyof RegisterFormData, string>> = {};

    fields.forEach((field) => {
      if (!registerData[field].trim()) {
        newErrors[field] = "Este campo es obligatorio.";
      }
    });

    for (const field of ["name", "surname"] as const) {
      if (
        fields.includes(field) &&
        registerData[field].trim() &&
        registerData[field].trim().length < 2
      ) {
        newErrors[field] = "Mínimo 2 caracteres.";
      }
    }

    if (fields.includes("phone") && registerData.phone && !/^\d{9}$/.test(registerData.phone)) {
      newErrors.phone = "Ingresa 9 dígitos, solo números.";
    }

    if (
      fields.includes("identityDocument") &&
      registerData.identityDocument &&
      !/^(\d{8}|\d{11})$/.test(registerData.identityDocument)
    ) {
      newErrors.identityDocument = "DNI (8 dígitos) o RUC (11 dígitos).";
    }

    if (
      fields.includes("address") &&
      registerData.address.trim() &&
      registerData.address.trim().length < 5
    ) {
      newErrors.address = "Mínimo 5 caracteres.";
    }

    if (
      fields.includes("email") &&
      registerData.email &&
      !/\S+@\S+\.\S+/.test(registerData.email)
    ) {
      newErrors.email = "El correo electrónico no es válido.";
    }

    if (fields.includes("password") && registerData.password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*\d).{6,}$/;
      if (!passwordRegex.test(registerData.password)) {
        newErrors.password =
          "La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número.";
      }
    }

    if (
      fields.includes("confirmPassword") &&
      registerData.confirmPassword &&
      registerData.password !== registerData.confirmPassword
    ) {
      newErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    return newErrors;
  };

  const handleOnRegister = async () => {
    const newErrors = validateFields(REGISTER_STEPS.flatMap((item) => item.fields));
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstErrorStep = REGISTER_STEPS.findIndex((item) =>
        item.fields.some((field) => newErrors[field]),
      );
      setStep(firstErrorStep);
      toast.error("Por favor completa correctamente el formulario.");
      return;
    }
    submittingRef.current = true;
    try {
      await onNext({
        name: registerData.name,
        surname: registerData.surname,
        email: registerData.email,
        password: registerData.password,
        phone: registerData.phone,
        identityDocument: registerData.identityDocument,
        address: registerData.address,
        district: registerData.district,
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || submittingRef.current) return;

    if (step === REGISTER_STEPS.length - 1) {
      await handleOnRegister();
      return;
    }

    const currentFields = REGISTER_STEPS[step].fields;
    const newErrors = validateFields(currentFields);
    setErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      currentFields.forEach((field) => {
        delete nextErrors[field];
      });
      return { ...nextErrors, ...newErrors };
    });
    if (Object.keys(newErrors).length > 0) {
      toast.error("Por favor completa correctamente el formulario.");
      return;
    }

    const nextStep = step + 1;
    setStep(nextStep);
    setFurthestStep((previousFurthestStep) => Math.max(previousFurthestStep, nextStep));
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className={`${styles.form} ${styles.registration}`} noValidate>
        <nav aria-label="Progreso del registro">
          <ol className={styles.stepper}>
            {REGISTER_STEPS.map((item, index) => (
              <li key={item.label}>
                <button
                  type="button"
                  className={`${styles.step} ${index === step ? styles.stepCurrent : ""} ${index < furthestStep && index !== step ? styles.stepComplete : ""}`}
                  onClick={() => setStep(index)}
                  disabled={index > furthestStep || (isLoading && index !== step)}
                  aria-label={item.label}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span className={styles.stepIndex} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.stepLabel}>{item.label}</span>
                  <span className={styles.stepLabelShort}>{item.shortLabel}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        {step === 0 && (
          <fieldset className={styles.section}>
            <legend ref={stepTitleRef} tabIndex={-1} className={styles.legend}>
              Datos personales
            </legend>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <Label htmlFor="register-name" className={styles.label}>
                  Nombre
                </Label>
                <Input
                  id="register-name"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Juan"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "register-name-error" : undefined}
                />
                {errors.name && (
                  <p id="register-name-error" className={styles.error}>
                    {errors.name}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-surname" className={styles.label}>
                  Apellido
                </Label>
                <Input
                  id="register-surname"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Pérez"
                  value={registerData.surname}
                  onChange={(e) => setRegisterData({ ...registerData, surname: e.target.value })}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.surname)}
                  aria-describedby={errors.surname ? "register-surname-error" : undefined}
                />
                {errors.surname && (
                  <p id="register-surname-error" className={styles.error}>
                    {errors.surname}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-document" className={styles.label}>
                  DNI / RUC
                </Label>
                <Input
                  id="register-document"
                  type="text"
                  inputMode="numeric"
                  placeholder="12345678"
                  value={registerData.identityDocument}
                  onChange={(e) =>
                    setRegisterData({
                      ...registerData,
                      identityDocument: e.target.value,
                    })
                  }
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.identityDocument)}
                  aria-describedby={errors.identityDocument ? "register-document-error" : undefined}
                />
                {errors.identityDocument && (
                  <p id="register-document-error" className={styles.error}>
                    {errors.identityDocument}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-phone" className={styles.label}>
                  WhatsApp (+51)
                </Label>
                <Input
                  id="register-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="987654321"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "register-phone-error" : undefined}
                />
                {errors.phone && (
                  <p id="register-phone-error" className={styles.error}>
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset className={styles.section}>
            <legend ref={stepTitleRef} tabIndex={-1} className={styles.legend}>
              Ubicación
            </legend>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <Label htmlFor="register-district" className={styles.label}>
                  Distrito
                </Label>
                <Input
                  id="register-district"
                  type="text"
                  autoComplete="address-level3"
                  placeholder="Miraflores"
                  value={registerData.district}
                  onChange={(e) => setRegisterData({ ...registerData, district: e.target.value })}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.district)}
                  aria-describedby={errors.district ? "register-district-error" : undefined}
                />
                {errors.district && (
                  <p id="register-district-error" className={styles.error}>
                    {errors.district}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-address" className={styles.label}>
                  Dirección
                </Label>
                <Input
                  id="register-address"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Av. Larco 123"
                  value={registerData.address}
                  onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? "register-address-error" : undefined}
                />
                {errors.address && (
                  <p id="register-address-error" className={styles.error}>
                    {errors.address}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className={styles.section}>
            <legend ref={stepTitleRef} tabIndex={-1} className={styles.legend}>
              Acceso a tu cuenta
            </legend>
            <div className={styles.fieldGrid}>
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <Label htmlFor="register-email" className={styles.label}>
                  Correo electrónico
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@negocio.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "register-email-error" : undefined}
                />
                {errors.email && (
                  <p id="register-email-error" className={styles.error}>
                    {errors.email}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-password" className={styles.label}>
                  Contraseña
                </Label>
                <div className={styles.password}>
                  <Input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    disabled={isLoading}
                    className={styles.passwordInput}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "register-password-error" : "register-password-hint"
                    }
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
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {!errors.password && (
                  <p id="register-password-hint" className={styles.hint}>
                    Mínimo 6 caracteres, una letra minúscula y un número.
                  </p>
                )}
                {errors.password && (
                  <p id="register-password-error" className={styles.error}>
                    {errors.password}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-confirm" className={styles.label}>
                  Confirmar contraseña
                </Label>
                <div className={styles.password}>
                  <Input
                    id="register-confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={registerData.confirmPassword}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        confirmPassword: e.target.value,
                      })
                    }
                    disabled={isLoading}
                    className={styles.passwordInput}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
                  />
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    aria-label={
                      showConfirmPassword
                        ? "Ocultar confirmación de contraseña"
                        : "Mostrar confirmación de contraseña"
                    }
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p id="register-confirm-error" className={styles.error}>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        )}

        {step === REGISTER_STEPS.length - 1 && error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          {step > 0 && (
            <button
              type="button"
              className={styles.secondary}
              disabled={isLoading}
              onClick={() => setStep((previousStep) => previousStep - 1)}
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Atrás
            </button>
          )}
          <button type="submit" disabled={isLoading} className={styles.submit}>
            {isLoading ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Creando cuenta...
              </>
            ) : (
              <>
                {step === REGISTER_STEPS.length - 1 ? "Crear cuenta" : "Continuar"}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>

      {step === REGISTER_STEPS.length - 1 && (
        <p className={styles.terms}>
          Al registrarte, aceptas nuestros{" "}
          <Link href="/terminos" className={styles.link}>
            Términos de Servicio
          </Link>{" "}
          y{" "}
          <Link href="/privacidad" className={styles.link}>
            Política de Privacidad
          </Link>
        </p>
      )}
    </div>
  );
}
