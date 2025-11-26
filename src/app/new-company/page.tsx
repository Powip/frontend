"use client";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Upload } from "lucide-react";
import { Currency, currencyOptions } from "@/enum/Currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Label from "@/components/ui/label";
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

export default function NewCompanyPage() {
  const { auth, updateCompany } = useAuth();
  const router = useRouter();

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

  useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth, router]);

  if (!auth) return null;

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
      const body = new FormData();
      body.append("name", formData.companyName);
      body.append("description", formData.description);
      body.append("user_id", auth.user.id);
      body.append("cuit", formData.cuit);
      body.append("billing_address", formData.billingAddress);
      body.append("phone", formData.phone);
      body.append("billing_email", formData.email);
      body.append("currency", formData.currency);

      if (formData.logo) {
        body.append("logo", formData.logo);
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/company`,
        body,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (response.status === 201) {
        toast.success("Compañía creada con éxito");

        updateCompany({
          id: response.data.id,
          name: response.data.name,
          store_id: response.data.store_id,
        });

        router.push("/dashboard");
      }
    } catch (err: any) {
      console.log("Error al crear la compañía:", err.response?.data || err);
      toast.error("Hubo un error al crear la empresa");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* HEADER */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold">Crea tu Empresa</h1>
            <p className="text-muted-foreground">
              Completa la información básica para comenzar
            </p>
          </div>
        </div>

        {/* FORM */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>Completa los datos obligatorios</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* NOMBRE */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Nombre de la Empresa *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((p) => ({ ...p, companyName: e.target.value }))
                  }
                  placeholder="Ej: Mi Empresa"
                  disabled={isLoading}
                  className={errors.companyName ? "border-red-500" : ""}
                />
                {errors.companyName && (
                  <p className="text-xs text-red-500">{errors.companyName}</p>
                )}
              </div>

              {/* LOGO */}
              <div className="space-y-2">
                <Label>Logo (Opcional)</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border">
                      <Image
                        src={logoPreview}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((p) => ({ ...p, description: e.target.value }))
                  }
                  rows={4}
                  disabled={isLoading}
                />
              </div>

              {/* CUIT */}
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT (Opcional)</Label>
                <Input
                  id="cuit"
                  value={formData.cuit}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((p) => ({ ...p, cuit: e.target.value }))
                  }
                  disabled={isLoading}
                  className={errors.cuit ? "border-red-500" : ""}
                />
                {errors.cuit && (
                  <p className="text-xs text-red-500">{errors.cuit}</p>
                )}
              </div>

              {/* BILLING ADDRESS */}
              <div className="space-y-2">
                <Label htmlFor="billingAddress">
                  Dirección de Facturación *
                </Label>
                <Input
                  id="billingAddress"
                  value={formData.billingAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((p) => ({
                      ...p,
                      billingAddress: e.target.value,
                    }))
                  }
                  placeholder="Ej: Av. Siempre Viva 742"
                  disabled={isLoading}
                  className={errors.billingAddress ? "border-red-500" : ""}
                />
                {errors.billingAddress && (
                  <p className="text-xs text-red-500">
                    {errors.billingAddress}
                  </p>
                )}
              </div>

              {/* PHONE & EMAIL */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Teléfono *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((p) => ({ ...p, phone: e.target.value }))
                    }
                    placeholder="Ej: +54 11 1234-5678"
                    disabled={isLoading}
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="Ej: empresa@correo.com"
                    disabled={isLoading}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* CURRENCY */}
              <div className="space-y-2">
                <Label>Moneda *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(val: string) =>
                    setFormData((p) => ({ ...p, currency: val as Currency }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
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
              </div>

              {/* INFO */}
              <div className="rounded-lg border p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Podrás modificar esta información después en Configuración.
                </p>
              </div>

              {/* SUBMIT */}
              <Button className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? "Creando empresa..." : "Crear Empresa y Comenzar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
