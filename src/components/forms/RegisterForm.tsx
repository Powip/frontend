"use client";
import axios from "axios";
import { useState } from "react";
import Label from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import Link from "next/link";
import { toast } from "sonner";

interface RegisterData {
  name: string;
  surname: string;
  phoneNumber: string;
  identityDocument: string;
  email: string;
  password: string;
  confirmPassword: string;
  district: string;
  address: string;
  username: string;
}
export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [registerData, setRegisterData] = useState<RegisterData>({
    name: "",
    surname: "",
    phoneNumber: "",
    identityDocument: "",
    email: "",
    password: "",
    confirmPassword: "",
    district: "",
    address: "",
    username: "jugernaut",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Campos requeridos
    const requiredFields: (keyof RegisterData)[] = [
      "name",
      "surname",
      "phoneNumber",
      "identityDocument",
      "email",
      "password",
      "confirmPassword",
      "district",
      "address",
    ];

    requiredFields.forEach((field) => {
      if (!registerData[field].trim()) {
        newErrors[field] = "Este campo es obligatorio.";
      }
    });

    // Validaciones específicas
    if (registerData.email && !/\S+@\S+\.\S+/.test(registerData.email)) {
      newErrors.email = "El correo electrónico no es válido.";
    }

    if (registerData.password && registerData.password.length < 6) {
      newErrors.password = "La contraseña debe tener al menos 6 caracteres.";
    }

    if (
      registerData.confirmPassword &&
      registerData.password !== registerData.confirmPassword
    ) {
      newErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSocialLogin = (provider: string) => {
    console.log(`[v0] Logging in with ${provider}`);
    // Handle social login
  };

  const handleOnRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Por favor completa correctamente el formulario.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:8080/api/v1/auth/register",
        registerData
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
          district: "",
          address: "",
          username: "jugernaut1",
        });
        setErrors({});
      }
    } catch (error) {
      toast.error("Error al crear la cuenta. Inténtalo de nuevo.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form
        onSubmit={handleOnRegister}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Nombre */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-name">Nombre</Label>
          <Input
            id="register-name"
            type="text"
            placeholder="Juan"
            value={registerData.name}
            onChange={(e) =>
              setRegisterData({ ...registerData, name: e.target.value })
            }
            disabled={isLoading}
            className={errors.name ? "border-red-500" : ""}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Apellido */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-surname">Apellido</Label>
          <Input
            id="register-surname"
            type="text"
            placeholder="Pérez"
            value={registerData.surname}
            onChange={(e) =>
              setRegisterData({ ...registerData, surname: e.target.value })
            }
            disabled={isLoading}
            className={errors.surname ? "border-red-500" : ""}
          />
          {errors.surname && (
            <p className="text-xs text-red-500">{errors.surname}</p>
          )}
        </div>

        {/* Documento */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-document">Documento de Identidad</Label>
          <Input
            id="register-document"
            type="text"
            placeholder="12345678"
            value={registerData.identityDocument}
            onChange={(e) =>
              setRegisterData({
                ...registerData,
                identityDocument: e.target.value,
              })
            }
            disabled={isLoading}
            className={errors.identityDocument ? "border-red-500" : ""}
          />
          {errors.identityDocument && (
            <p className="text-xs text-red-500">{errors.identityDocument}</p>
          )}
        </div>

        {/* Teléfono */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-phone">Número de Teléfono</Label>
          <Input
            id="register-phone"
            type="text"
            placeholder="987654321"
            value={registerData.phoneNumber}
            onChange={(e) =>
              setRegisterData({ ...registerData, phoneNumber: e.target.value })
            }
            disabled={isLoading}
            className={errors.phoneNumber ? "border-red-500" : ""}
          />
          {errors.phoneNumber && (
            <p className="text-xs text-red-500">{errors.phoneNumber}</p>
          )}
        </div>

        {/* Distrito */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-district">Distrito</Label>
          <Input
            id="register-district"
            type="text"
            placeholder="Miraflores"
            value={registerData.district}
            onChange={(e) =>
              setRegisterData({ ...registerData, district: e.target.value })
            }
            disabled={isLoading}
            className={errors.district ? "border-red-500" : ""}
          />
          {errors.district && (
            <p className="text-xs text-red-500">{errors.district}</p>
          )}
        </div>

        {/* Dirección */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-address">Dirección</Label>
          <Input
            id="register-address"
            type="text"
            placeholder="Av. Siempre Viva 123"
            value={registerData.address}
            onChange={(e) =>
              setRegisterData({ ...registerData, address: e.target.value })
            }
            disabled={isLoading}
            className={errors.address ? "border-red-500" : ""}
          />
          {errors.address && (
            <p className="text-xs text-red-500">{errors.address}</p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col space-y-1 md:col-span-2">
          <Label htmlFor="register-email">Correo electrónico</Label>
          <Input
            id="register-email"
            type="email"
            placeholder="tu@email.com"
            value={registerData.email}
            onChange={(e) =>
              setRegisterData({ ...registerData, email: e.target.value })
            }
            disabled={isLoading}
            className={errors.email ? "border-red-500" : ""}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Contraseña */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-password">Contraseña</Label>
          <Input
            id="register-password"
            type="password"
            placeholder="••••••••"
            value={registerData.password}
            onChange={(e) =>
              setRegisterData({ ...registerData, password: e.target.value })
            }
            disabled={isLoading}
            className={errors.password ? "border-red-500" : ""}
          />
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password}</p>
          )}
        </div>

        {/* Confirmación */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-confirm">Confirmar contraseña</Label>
          <Input
            id="register-confirm"
            type="password"
            placeholder="••••••••"
            value={registerData.confirmPassword}
            onChange={(e) =>
              setRegisterData({
                ...registerData,
                confirmPassword: e.target.value,
              })
            }
            disabled={isLoading}
            className={errors.confirmPassword ? "border-red-500" : ""}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Botón */}
        <div className="md:col-span-2">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </div>
      </form>

      {/* Separador */}
      <div className="relative md:col-span-2 p-2">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            O regístrate con
          </span>
        </div>
      </div>

      {/* Login social */}
      <div className="grid gap-2 md:col-span-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("google")}
          disabled={isLoading}
          className="w-full"
        >
          Google
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("facebook")}
          disabled={isLoading}
          className="w-full"
        >
          Facebook
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => handleSocialLogin("outlook")}
          disabled={isLoading}
          className="w-full"
        >
          Outlook
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground md:col-span-2 pt-2">
        Al registrarte, aceptas nuestros{" "}
        <Link href="/terminos" className="text-primary hover:underline">
          Términos de Servicio
        </Link>{" "}
        y{" "}
        <Link href="/privacidad" className="text-primary hover:underline">
          Política de Privacidad
        </Link>
      </p>
    </div>
  );
}
