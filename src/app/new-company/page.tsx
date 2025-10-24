"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Upload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Currency, currencyOptions } from "@/enum/Currency";
import axios from "axios";
import { toast } from "sonner";

/* 
Manejar carga de imagenes -> Backend
*/

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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    description: "",
    logo: null as File | null,
    cuit: "",
    billingAddress: "",
    phone: "",
    email: "",
    currency: Currency.PEN,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Campos requeridos
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

    // Validación de email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "El correo electrónico no es válido.";
    }

    // Validación opcional de CUIT
    if (formData.cuit && !/^\d{2}-\d{8}-\d{1}$/.test(formData.cuit)) {
      newErrors.cuit = "El formato del CUIT no es válido (ej: 20-12345678-9).";
    }

    // Validación opcional del logo
    if (formData.logo && formData.logo.size > 2 * 1024 * 1024) {
      newErrors.logo = "El logo no debe superar los 2MB.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, logo: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Por favor completa correctamente el formulario.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post(
        "https://ms-company-s5k4.onrender.com/company",
        formData
      );
      if (response.status === 201) {
        toast.success("Compañia creada con exito");
      }
    } catch (error) {
      console.log("Error al crear la compañia", error);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 py-12">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              Crea tu Empresa
            </h1>
            <p className="text-muted-foreground">
              Completa la información básica para comenzar a usar Powip
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Información de la Empresa</CardTitle>
            <CardDescription>
              Ingresa los datos básicos de tu negocio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName">
                  Nombre de la Empresa{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="companyName"
                  placeholder="Mi Tienda Online"
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      companyName: e.target.value,
                    }))
                  }
                  required
                  disabled={isLoading}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.companyName && (
                  <p className="text-xs text-red-500">{errors.companyName}</p>
                )}
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="logo">Logo de la Empresa</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-border">
                      <Image
                        src={logoPreview || "/placeholder.svg"}
                        alt="Logo preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={isLoading}
                      className="cursor-pointer"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG, JPG o JPEG (máx. 2MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describe brevemente tu negocio y lo que ofreces..."
                  rows={4}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional - Puedes agregar más detalles después
                </p>
              </div>

              {/* CUIT */}
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  placeholder="20-12345678-9"
                  value={formData.cuit}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cuit: e.target.value }))
                  }
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional - Número de identificación tributaria
                </p>
              </div>
              {/* Direccion de Facturacion */}
              <div className="space-y-2">
                <Label htmlFor="billingAddress">
                  Dirección de Facturación
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="billingAddress"
                  placeholder="Calle 123, Ciudad, Provincia"
                  value={formData.billingAddress}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      billingAddress: e.target.value,
                    }))
                  }
                  required
                  disabled={isLoading}
                  className={errors.billingAddress ? "border-red-500" : ""}
                />
                {errors.billingAddress && (
                  <p className="text-xs text-red-500">
                    {errors.billingAddress}
                  </p>
                )}
              </div>
              {/* Numero de Telefono */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Número de Teléfono
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+54 11 1234-5678"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    required
                    disabled={isLoading}
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="empresa@ejemplo.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    required
                    disabled={isLoading}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">
                  Moneda <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      currency: value as Currency,
                    }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Selecciona una moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info Box */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Podrás modificar esta información y agregar más detalles desde
                  la configuración de tu cuenta.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Creando empresa..." : "Crear Empresa y Comenzar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
