"use client";
import axios from "axios";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ubigeosData from "@/utils/json/ubigeos.json";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import styles from "./auth-form.module.css";

interface RegisterData {
  name: string;
  surname: string;
  phoneNumber: string;
  identityDocument: string;
  email: string;
  password: string;
  confirmPassword: string;
  department: string;
  province: string;
  district: string;
  address: string;
  username: string;
}

const REGISTER_STEPS: { label: string; shortLabel: string; fields: (keyof RegisterData)[] }[] = [
  {
    label: "Datos personales",
    shortLabel: "Datos",
    fields: ["name", "surname", "identityDocument", "phoneNumber"],
  },
  {
    label: "Ubicación",
    shortLabel: "Ubicación",
    fields: ["department", "province", "district", "address"],
  },
  {
    label: "Acceso a tu cuenta",
    shortLabel: "Cuenta",
    fields: ["email", "password", "confirmPassword"],
  },
];

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
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

  const [registerData, setRegisterData] = useState<RegisterData>({
    name: "",
    surname: "",
    phoneNumber: "",
    identityDocument: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    province: "",
    district: "",
    address: "",
    username: "jugernaut",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Ubigeos data processing
  const departments = useMemo(() => {
    return ubigeosData[0]?.departments || [];
  }, []);

  const provinces = useMemo(() => {
    if (!registerData.department) return [];
    const dept = departments.find((d: any) => d.name === registerData.department);
    return dept?.provinces || [];
  }, [registerData.department, departments]);

  const districts = useMemo(() => {
    if (!registerData.province) return [];
    const prov = provinces.find((p: any) => p.name === registerData.province);
    return prov?.districts || [];
  }, [registerData.province, provinces]);

  const handleDepartmentChange = (value: string) => {
    setRegisterData({
      ...registerData,
      department: value,
      province: "",
      district: "",
    });
  };

  const handleProvinceChange = (value: string) => {
    setRegisterData({
      ...registerData,
      province: value,
      district: "",
    });
  };

  const validateFields = (fields: (keyof RegisterData)[]) => {
    const newErrors: { [key: string]: string } = {};

    fields.forEach((field) => {
      if (!registerData[field].trim()) {
        newErrors[field] = "Este campo es obligatorio.";
      }
    });

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
    setIsLoading(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_USERS}/auth/register`,
        registerData,
      );

      if (response.status === 200) {
        toast.success("Cuenta creada exitosamente 🎉");

        setRegisterData({
          name: "",
          surname: "",
          phoneNumber: "",
          identityDocument: "",
          email: "",
          password: "",
          confirmPassword: "",
          department: "",
          province: "",
          district: "",
          address: "",
          username: "jugernaut1",
        });
        setErrors({});
        setStep(0);
        setFurthestStep(0);
      }
    } catch (error: any) {
      let message = "Error al crear la cuenta. Inténtalo de nuevo.";

      if (error?.response?.data) {
        const data = error.response.data;
        if (data.errors && Array.isArray(data.errors)) {
          message = data.errors.map((e: any) => e.defaultMessage || e.message).join(". ");
        } else if (data.message) {
          message = data.message;
        }
      }

      toast.error(message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

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
                  Documento de identidad
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
                  Número de teléfono
                </Label>
                <Input
                  id="register-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="987654321"
                  value={registerData.phoneNumber}
                  onChange={(e) =>
                    setRegisterData({ ...registerData, phoneNumber: e.target.value })
                  }
                  disabled={isLoading}
                  className={styles.input}
                  aria-invalid={Boolean(errors.phoneNumber)}
                  aria-describedby={errors.phoneNumber ? "register-phone-error" : undefined}
                />
                {errors.phoneNumber && (
                  <p id="register-phone-error" className={styles.error}>
                    {errors.phoneNumber}
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
                <Label htmlFor="register-department" className={styles.label}>
                  Departamento
                </Label>
                <Select
                  value={registerData.department}
                  onValueChange={handleDepartmentChange}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    id="register-department"
                    className={styles.select}
                    aria-invalid={Boolean(errors.department)}
                    aria-describedby={errors.department ? "register-department-error" : undefined}
                  >
                    <SelectValue placeholder="Selecciona departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.name} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && (
                  <p id="register-department-error" className={styles.error}>
                    {errors.department}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-province" className={styles.label}>
                  Provincia
                </Label>
                <Select
                  value={registerData.province}
                  onValueChange={handleProvinceChange}
                  disabled={isLoading || !registerData.department}
                >
                  <SelectTrigger
                    id="register-province"
                    className={styles.select}
                    aria-invalid={Boolean(errors.province)}
                    aria-describedby={errors.province ? "register-province-error" : undefined}
                  >
                    <SelectValue placeholder="Selecciona provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((prov: any) => (
                      <SelectItem key={prov.name} value={prov.name}>
                        {prov.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.province && (
                  <p id="register-province-error" className={styles.error}>
                    {errors.province}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <Label htmlFor="register-district" className={styles.label}>
                  Distrito
                </Label>
                <Select
                  value={registerData.district}
                  onValueChange={(value) => setRegisterData({ ...registerData, district: value })}
                  disabled={isLoading || !registerData.province}
                >
                  <SelectTrigger
                    id="register-district"
                    className={styles.select}
                    aria-invalid={Boolean(errors.district)}
                    aria-describedby={errors.district ? "register-district-error" : undefined}
                  >
                    <SelectValue placeholder="Selecciona distrito" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((dist: string) => (
                      <SelectItem key={dist} value={dist}>
                        {dist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  placeholder="Av. Siempre Viva 123"
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
