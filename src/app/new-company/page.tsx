"use client";
import axiosAuth from "@/lib/axiosAuth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Upload, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Currency, currencyOptions } from "@/enum/Currency";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { fetchUserCompany } from "@/services/companyService";
import { GATEWAY } from "@/lib/gateway";
import { Label } from "@/components/ui/label";

interface FormData {
  companyName: string;
  description: string;
  logo: File | null;
  cuit: string;
  billingAddress: string;
  phone: string;
  email: string;
  currency: Currency;
}

const STEPS = [
  { num: 1, name: "Tu empresa" },
  { num: 2, name: "Facturación" },
];

function CompanyProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, idx) => {
        const isCompleted = step.num < currentStep;
        const isCurrent = step.num === currentStep;

        return (
          <div
            key={step.num}
            className="flex items-center flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                style={{
                  background: isCompleted
                    ? "#e9f5f3"
                    : isCurrent
                      ? "#4F3A96"
                      : "#f3f4f6",
                  color: isCompleted
                    ? "#008a7b"
                    : isCurrent
                      ? "white"
                      : "#9ca3af",
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(79,58,150,0.12)"
                    : "none",
                }}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.num}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap"
                style={{
                  color: isCompleted
                    ? "#008a7b"
                    : isCurrent
                      ? "#4F3A96"
                      : "#9ca3af",
                }}
              >
                {step.name}
              </span>
            </div>

            {idx < STEPS.length - 1 && (
              <div
                className="flex-1 h-0.5 mb-5 mx-1 transition-all duration-300"
                style={{
                  background:
                    step.num < currentStep
                      ? "linear-gradient(90deg, #008a7b, #4F3A96)"
                      : "#e5e7eb",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewCompanyPage() {
  const { auth, updateCompany, setSelectedStore, refreshAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    companyName: "",
    description: "",
    logo: null,
    cuit: "",
    billingAddress: "",
    phone: "",
    email: "",
    currency: Currency.PEN,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // VALIDATION
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const requiredFields: (keyof FormData)[] = [
      "companyName",
      "billingAddress",
      "phone",
      "email",
      "currency",
    ];

    requiredFields.forEach((field) => {
      const value = formData[field];
      if (typeof value === "string" && !value.trim()) {
        newErrors[field] = "Este campo es obligatorio.";
      }
    });

    // Email format
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "El correo electrónico no es válido.";
    }

    // CUIT (optional)
    if (formData.cuit && !/^\d{2}-\d{8}-\d{1}$/.test(formData.cuit)) {
      newErrors.cuit = "Formato inválido (ej: 20-12345678-9).";
    }

    // Logo size (optional)
    if (formData.logo && formData.logo.size > 2 * 1024 * 1024) {
      newErrors.logo = "El logo no debe superar los 2MB.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, logo: file }));

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Por favor completa correctamente el formulario.");
      return;
    }

    setIsLoading(true);
    try {
      if (!auth) {
        setIsLoading(false);
        return;
      }

      const body = new FormData();
      body.append("name", formData.companyName);
      body.append("description", formData.description);
      body.append("cuit", formData.cuit);
      body.append("billing_address", formData.billingAddress);
      body.append("phone", formData.phone);
      body.append("billing_email", formData.email);
      body.append("currency", formData.currency);

      if (formData.logo) {
        body.append("logo", formData.logo);
      }

      const url = `${GATEWAY.company}/company`;

      try {
        await axiosAuth.post(url, body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (postErr: unknown) {
        const status = (postErr as { response?: { status?: number } })?.response?.status;
        // 504 = Gateway timeout: ms-company guarda en DB pero el evento RabbitMQ
        // de la tienda default cuelga hasta que el Gateway corta la conexión.
        // Verificamos si la company fue creada igual antes de mostrar error.
        if (status !== 504 && status !== 408) throw postErr;
        // 504/408: Gateway timeout — ms-company puede haber guardado igual.
        // Verificamos si la company fue creada antes de mostrar error.
      }

      const fullCompany = await fetchUserCompany(auth.user.id);

      if (!fullCompany) {
        toast.error("Hubo un error al crear la empresa");
        return;
      }

      toast.success("Compañía creada con éxito");
      updateCompany(fullCompany);

      if (fullCompany.stores && fullCompany.stores.length > 0) {
        setSelectedStore(fullCompany.stores[0].id);
      }

      // Esperamos a que ms-auth procese el evento de cambio de rol (USUARIO -> ADMINISTRADOR)
      // antes de refrescar el JWT, ya que ese cambio se persiste de forma asíncrona.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        await refreshAuth();
      } catch {
        // best-effort: si falla el refresh, el rol se actualizará en el próximo refresh de página
      }

      router.push(auth.subscription ? "/dashboard" : "/sin-plan");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || "Hubo un error al crear la empresa";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: "#f7f5ff" }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "#4F3A96" }}
          >
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">
            Configura tu empresa
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1
              ? "Cuéntanos sobre tu negocio."
              : "Datos de contacto y facturación."}
          </p>
        </div>

        {/* Progress */}
        <CompanyProgress currentStep={step} />

        {/* Card */}
        <div
          className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border mb-4"
          style={{ borderColor: "rgba(79,58,150,0.08)" }}
        >
          <form onSubmit={handleSubmit}>
            {/* STEP 1 */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                {/* Nombre */}
                <div>
                  <Label htmlFor="companyName">
                    Nombre de la empresa <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        companyName: e.target.value,
                      }))
                    }
                    placeholder="Ej: Mi Empresa SAC"
                    disabled={isLoading}
                    className={`mt-1.5 ${errors.companyName ? "border-red-400" : ""}`}
                  />
                  {errors.companyName && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.companyName}
                    </p>
                  )}
                </div>

                {/* Logo */}
                <div>
                  <Label>
                    Logo{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <label
                    className="mt-1.5 flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-[#4F3A96]/40"
                    style={{
                      borderColor: logoPreview ? "#4F3A96" : "#e5e7eb",
                    }}
                  >
                    {logoPreview ? (
                      <Image
                        src={logoPreview}
                        alt="Preview"
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {logoPreview ? "Cambiar logo" : "Subir logo"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        PNG, JPG hasta 2MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                      disabled={isLoading}
                    />
                  </label>
                  {errors.logo && (
                    <p className="text-xs text-red-500 mt-1">{errors.logo}</p>
                  )}
                </div>

                {/* Descripción */}
                <div>
                  <Label htmlFor="description">
                    Descripción{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Breve descripción de tu negocio..."
                    rows={3}
                    disabled={isLoading}
                    className="mt-1.5"
                  />
                </div>

                {/* Moneda */}
                <div>
                  <Label>
                    Moneda <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(val) =>
                      setFormData((p) => ({ ...p, currency: val as Currency }))
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecciona una moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.currency && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.currency}
                    </p>
                  )}
                </div>

                {/* Botón siguiente */}
                <Button
                  type="button"
                  size="lg"
                  className="w-full h-12 rounded-xl text-base font-semibold mt-2 flex items-center justify-center gap-2"
                  style={{ background: "#4F3A96" }}
                  onClick={() => {
                    const e: Record<string, string> = {};
                    if (!formData.companyName.trim())
                      e.companyName = "Este campo es obligatorio.";
                    if (!formData.currency)
                      e.currency = "Este campo es obligatorio.";
                    if (Object.keys(e).length > 0) {
                      setErrors(e);
                      return;
                    }
                    setErrors({});
                    setStep(2);
                  }}
                >
                  Continuar <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                {/* Dirección de facturación */}
                <div>
                  <Label htmlFor="billingAddress">
                    Dirección de facturación{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="billingAddress"
                    value={formData.billingAddress}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        billingAddress: e.target.value,
                      }))
                    }
                    placeholder="Av. Siempre Viva 742, Lima"
                    disabled={isLoading}
                    className={`mt-1.5 ${errors.billingAddress ? "border-red-400" : ""}`}
                  />
                  {errors.billingAddress && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.billingAddress}
                    </p>
                  )}
                </div>

                {/* Teléfono + Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">
                      Teléfono <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, phone: e.target.value }))
                      }
                      placeholder="+51 987 654 321"
                      disabled={isLoading}
                      className={`mt-1.5 ${errors.phone ? "border-red-400" : ""}`}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="email">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="empresa@correo.com"
                      disabled={isLoading}
                      className={`mt-1.5 ${errors.email ? "border-red-400" : ""}`}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* RUC / CUIT */}
                <div>
                  <Label htmlFor="cuit">
                    RUC / CUIT{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="cuit"
                    value={formData.cuit}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, cuit: e.target.value }))
                    }
                    placeholder="Ej: 20-12345678-9"
                    disabled={isLoading}
                    className={`mt-1.5 ${errors.cuit ? "border-red-400" : ""}`}
                  />
                  {errors.cuit && (
                    <p className="text-xs text-red-500 mt-1">{errors.cuit}</p>
                  )}
                </div>

                {/* Nota informativa */}
                <div
                  className="flex items-center gap-2.5 p-3.5 rounded-xl text-sm"
                  style={{ background: "#f5f2ff", color: "#4F3A96" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(79,58,150,0.15)" }}
                  >
                    <span className="text-xs font-bold">i</span>
                  </div>
                  <p>
                    Podés modificar esta información después en{" "}
                    <strong>Configuración</strong>.
                  </p>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-12 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
                  style={{ background: "#4F3A96" }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creando empresa...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      Crear empresa y comenzar
                    </>
                  )}
                </Button>

                {/* Volver */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 w-full py-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
