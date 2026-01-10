"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { ISubscription } from "@/interfaces/ISubscription";
import axios from "axios";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface ICompany {
  id: string;
  name: string;
  description?: string | null;
  billing_address: string;
  phone: string;
  billing_email: string;
  logo_url?: string | null;
  currency: string;
  cuit?: string | null;
  iva: number;
}

export default function EmpresaPage() {
  const [company, setCompany] = useState<ICompany>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [subscription, setSubscription] = useState<ISubscription | null>(null);

  

  const router = useRouter();
  const { auth } = useAuth();
    
     
    useEffect(() => {
      if (!auth) router.push("/login");
    }, [auth, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth?.company?.id || !auth?.user?.id) return;

      setIsLoading(true);
      try {
        // --- Fetch Company ---
        const companyRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${auth.company.id}`
        );
        setCompany(companyRes.data);

        // --- Fetch Subscription ---
        const subRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_SUBS}/subscriptions/${auth.subscription?.id}`
        );

        setSubscription(subRes.data);
        console.log("Subscription:", subRes.data);
      } catch (error) {
        console.log("Error al cargar datos de empresa o suscripción:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [auth]);

  if (!auth) return null;

  if (!company) {
    return <div>Cargando...</div>;
  }

  const validateCompany = () => {
    const newErrors: Record<string, string> = {};

    if (!company?.name?.trim()) newErrors.name = "El nombre es obligatorio.";
    if (!company?.billing_address?.trim())
      newErrors.billing_address = "La dirección es obligatoria.";
    if (!company?.phone?.trim())
      newErrors.phone = "El teléfono es obligatorio.";
    if (!company?.billing_email?.trim())
      newErrors.billing_email = "El email de facturación es obligatorio.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateCompany()) return;

    try {
      setIsLoading(true);

      const formData = new FormData();

      // Campos:
      formData.append("name", company.name);
      formData.append("billing_address", company.billing_address);
      formData.append("phone", company.phone);
      formData.append("billing_email", company.billing_email);

      if (company.description)
        formData.append("description", company.description);
      if (company.currency) formData.append("currency", company.currency);
      if (company.cuit) formData.append("cuit", company.cuit);
      if (company.iva !== undefined)
        formData.append("iva", String(company.iva));

      if (logoFile) formData.append("logo", logoFile);

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COMPANY}/company/${company.id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Empresa actualizada");
    } catch (error) {
      console.log("Error", error);
      toast.error("Error al actualizar la empresa");
    } finally {
      setIsLoading(false);
    }
  };

  if (!auth) return null;

  return (
    <div className="flex min-h-screen">
      <main className="flex-1 py-4 px-6">
        <HeaderConfig
          title="Empresa + Suscripción"
          description="Información de la empresa y gestión de planes"
        />

        <div className="grid gap-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Información de la empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nombre de la empresa</Label>
                <Input
                  id="company-name"
                  value={company.name}
                  onChange={(e) =>
                    setCompany({ ...company, name: e.target.value })
                  }
                />
                {errors.name && (
                  <p className="text-red-500 text-sm">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={company.description ?? ""}
                  onChange={(e) =>
                    setCompany({ ...company, description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={company.billing_address}
                  onChange={(e) =>
                    setCompany({ ...company, billing_address: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={company.phone}
                    onChange={(e) =>
                      setCompany({
                        ...company,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={company.billing_email}
                    onChange={(e) =>
                      setCompany({
                        ...company,
                        billing_email: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">Logo de la empresa</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración regional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={company.currency}
                  onValueChange={(value) =>
                    setCompany({ ...company, currency: value })
                  }
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Seleccionar moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - Dólar</SelectItem>
                    <SelectItem value="PEN">PEN - Peso Peruano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT/RUC</Label>
                <Input
                  id="cuit"
                  type="number"
                  value={company.cuit ?? ""}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      cuit: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax">IVA (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  value={company.iva}
                  onChange={(e) =>
                    setCompany({
                      ...company,
                      iva: Number(e.target.value),
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Suscripción activa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between rounded-lg border border-teal-200 bg-teal-50 p-4">
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-teal-900">
                  <Check className="h-5 w-5" />
                  Plan {subscription?.plan.name}
                </h3>
                <p className="text-sm text-teal-700">
                  ${subscription?.plan.price} USD por mes
                </p>
                <p className="text-sm text-teal-600">
                  Renovación:{" "}
                  {subscription?.endDate
                    ? new Date(subscription.endDate).toLocaleDateString(
                        "es-AR",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )
                    : "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Mejorar plan</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Cambiar suscripción</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Selecciona un nuevo plan para tu empresa:
                      </p>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-transparent"
                        >
                          Plan Basic - $19.99
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-transparent"
                        >
                          Plan Medium - $49.99
                        </Button>
                        <Button className="w-full justify-start bg-teal-600 hover:bg-teal-700">
                          Plan Premium - $99.99 (actual)
                        </Button>
                      </div>
                      <Button className="w-full bg-teal-600 hover:bg-teal-700">
                        Continuar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">Darse de baja</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Cancelar suscripción</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        ¿Estás seguro de que deseas cancelar tu suscripción?
                        Perderás acceso a todas las funciones Premium.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 bg-transparent"
                        >
                          Mantener suscripción
                        </Button>
                        <Button variant="destructive" className="flex-1">
                          Cancelar suscripción
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            className="bg-teal-600 hover:bg-teal-700"
            disabled={isLoading}
            onClick={handleSave}
          >
            {isLoading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </main>
    </div>
  );
}
