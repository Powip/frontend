"use client";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { RegisterData } from "@/hooks/useOnboardingFlow";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AuthErrorNotice, FieldError, notifyAuthError } from "./AuthFeedback";
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

const FIELD_INFO: Record<keyof RegisterFormData, { id: string; label: string }> = {
  name: { id: "register-name", label: "Nombre" },
  surname: { id: "register-surname", label: "Apellido" },
  identityDocument: { id: "register-document", label: "DNI / RUC" },
  phone: { id: "register-phone", label: "WhatsApp" },
  district: { id: "register-district", label: "Distrito" },
  address: { id: "register-address", label: "Dirección" },
  email: { id: "register-email", label: "Correo electrónico" },
  password: { id: "register-password", label: "Contraseña" },
  confirmPassword: { id: "register-confirm", label: "Confirmar contraseña" },
};

export default function RegisterForm({ isLoading, error, onNext }: RegisterFormProps) {
  const submittingRef = useRef(false);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocusRef = useRef<keyof RegisterFormData | null>(null);
  const previousStepRef = useRef(step);

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

  useEffect(() => {
    const pendingField = pendingFocusRef.current;
    if (pendingField && errors[pendingField]) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`#${FIELD_INFO[pendingField].id}`)
        ?.focus({ preventScroll: true });
      pendingFocusRef.current = null;
    } else if (previousStepRef.current !== step) {
      formRef.current
        ?.querySelector<HTMLInputElement>("input:not(:disabled)")
        ?.focus({ preventScroll: true });
    }
    previousStepRef.current = step;
  }, [step, errors]);

  const validateFields = (fields: (keyof RegisterFormData)[], values = registerData) => {
    const newErrors: Partial<Record<keyof RegisterFormData, string>> = {};

    fields.forEach((field) => {
      if (!values[field].trim()) {
        newErrors[field] = "Este campo es obligatorio.";
      }
    });

    for (const field of ["name", "surname"] as const) {
      if (fields.includes(field) && values[field].trim() && values[field].trim().length < 2) {
        newErrors[field] = "Mínimo 2 caracteres.";
      }
    }

    if (fields.includes("phone") && values.phone && !/^\d{9}$/.test(values.phone)) {
      newErrors.phone = "Ingresa 9 dígitos, solo números.";
    }

    if (
      fields.includes("identityDocument") &&
      values.identityDocument &&
      !/^(\d{8}|\d{11})$/.test(values.identityDocument)
    ) {
      newErrors.identityDocument = "DNI (8 dígitos) o RUC (11 dígitos).";
    }

    if (fields.includes("address") && values.address.trim() && values.address.trim().length < 5) {
      newErrors.address = "Mínimo 5 caracteres.";
    }

    if (fields.includes("email") && values.email && !/\S+@\S+\.\S+/.test(values.email)) {
      newErrors.email = "El correo electrónico no es válido.";
    }

    if (fields.includes("password") && values.password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*\d).{6,}$/;
      if (!passwordRegex.test(values.password)) {
        newErrors.password = "Usa 6 caracteres o más, una minúscula y un número.";
      }
    }

    if (
      fields.includes("confirmPassword") &&
      values.confirmPassword &&
      values.password !== values.confirmPassword
    ) {
      newErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    return newErrors;
  };

  const updateField = (field: keyof RegisterFormData, value: string) => {
    const nextData = { ...registerData, [field]: value };
    setRegisterData(nextData);
    const affectedFields: (keyof RegisterFormData)[] = [field];
    if (field === "password") affectedFields.push("confirmPassword");
    const invalidFields = affectedFields.filter((item) => Boolean(errors[item]));
    if (invalidFields.length === 0) return;
    const updatedErrors = validateFields(invalidFields, nextData);
    setErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      for (const item of invalidFields) {
        delete nextErrors[item];
      }
      return { ...nextErrors, ...updatedErrors };
    });
  };

  const reportValidationErrors = (newErrors: Partial<Record<keyof RegisterFormData, string>>) => {
    const firstField = REGISTER_STEPS.flatMap((item) => item.fields).find(
      (field) => newErrors[field],
    );
    if (!firstField) return;
    pendingFocusRef.current = firstField;
    setStep(REGISTER_STEPS.findIndex((item) => item.fields.includes(firstField)));
    notifyAuthError(
      "Revisa tus datos",
      `${FIELD_INFO[firstField].label}: ${newErrors[firstField]}`,
    );
  };

  const handleOnRegister = async () => {
    const newErrors = validateFields(REGISTER_STEPS.flatMap((item) => item.fields));
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      reportValidationErrors(newErrors);
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
      reportValidationErrors(newErrors);
      return;
    }

    const nextStep = step + 1;
    setStep(nextStep);
    setFurthestStep((previousFurthestStep) => Math.max(previousFurthestStep, nextStep));
  };

  const hasCurrentErrors = REGISTER_STEPS[step].fields.some((field) => Boolean(errors[field]));

  return (
    <div className="w-full">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`${styles.form} ${styles.registration}`}
        aria-busy={isLoading}
        noValidate
      >
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
            <legend className={styles.legend}>Datos personales</legend>
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
                  onChange={(e) => updateField("name", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "register-name-error" : undefined}
                />
                <FieldError id="register-name-error" message={errors.name} />
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
                  onChange={(e) => updateField("surname", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.surname)}
                  aria-describedby={errors.surname ? "register-surname-error" : undefined}
                />
                <FieldError id="register-surname-error" message={errors.surname} />
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
                  onChange={(e) => updateField("identityDocument", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.identityDocument)}
                  aria-describedby={errors.identityDocument ? "register-document-error" : undefined}
                />
                <FieldError id="register-document-error" message={errors.identityDocument} />
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
                  onChange={(e) => updateField("phone", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? "register-phone-error" : undefined}
                />
                <FieldError id="register-phone-error" message={errors.phone} />
              </div>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Ubicación</legend>
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
                  onChange={(e) => updateField("district", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.district)}
                  aria-describedby={errors.district ? "register-district-error" : undefined}
                />
                <FieldError id="register-district-error" message={errors.district} />
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
                  onChange={(e) => updateField("address", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.address)}
                  aria-describedby={errors.address ? "register-address-error" : undefined}
                />
                <FieldError id="register-address-error" message={errors.address} />
              </div>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className={styles.section}>
            <legend className={styles.legend}>Acceso a tu cuenta</legend>
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
                  onChange={(e) => updateField("email", e.target.value)}
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "register-email-error" : undefined}
                />
                <FieldError id="register-email-error" message={errors.email} />
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
                    onChange={(e) => updateField("password", e.target.value)}
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
                    Mínimo 6 caracteres, minúscula y número.
                  </p>
                )}
                <FieldError id="register-password-error" message={errors.password} />
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
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
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
                <FieldError id="register-confirm-error" message={errors.confirmPassword} />
              </div>
            </div>
          </fieldset>
        )}

        {step === REGISTER_STEPS.length - 1 && error && !hasCurrentErrors && (
          <AuthErrorNotice title="No pudimos continuar" message={error} />
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
          <Link
            href="https://www.powip.lat/terminos"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Términos de Servicio (se abre en una nueva pestaña)"
            className={styles.link}
          >
            Términos de Servicio
          </Link>{" "}
          y{" "}
          <Link
            href="https://www.powip.lat/privacidad"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Política de Privacidad (se abre en una nueva pestaña)"
            className={styles.link}
          >
            Política de Privacidad
          </Link>
        </p>
      )}
    </div>
  );
}
