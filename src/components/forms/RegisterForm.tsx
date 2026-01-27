"use client";
import axios from "axios";
import { useState, useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import Link from "next/link";
import { toast } from "sonner";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import ubigeosData from "@/utils/json/ubigeos.json";

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

export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
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
    const dept = departments.find(
      (d: any) => d.name === registerData.department,
    );
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
      "department",
      "province",
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

    if (registerData.password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*\d).{6,}$/;
      if (!passwordRegex.test(registerData.password)) {
        newErrors.password =
          "La contraseña debe tener al menos 6 caracteres, una letra minúscula y un número.";
      }
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
      }
    } catch (error: any) {
      let message = "Error al crear la cuenta. Inténtalo de nuevo.";

      if (error?.response?.data) {
        const data = error.response.data;
        if (data.errors && Array.isArray(data.errors)) {
          message = data.errors
            .map((e: any) => e.defaultMessage || e.message)
            .join(". ");
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

  return (
    <div className="w-full">
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

        {/* Departamento */}
        <div className="flex flex-col space-y-1">
          <Label>Departamento</Label>
          <Select
            value={registerData.department}
            onValueChange={handleDepartmentChange}
            disabled={isLoading}
          >
            <SelectTrigger
              className={errors.department ? "border-red-500" : ""}
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
            <p className="text-xs text-red-500">{errors.department}</p>
          )}
        </div>

        {/* Provincia */}
        <div className="flex flex-col space-y-1">
          <Label>Provincia</Label>
          <Select
            value={registerData.province}
            onValueChange={handleProvinceChange}
            disabled={isLoading || !registerData.department}
          >
            <SelectTrigger className={errors.province ? "border-red-500" : ""}>
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
            <p className="text-xs text-red-500">{errors.province}</p>
          )}
        </div>

        {/* Distrito */}
        <div className="flex flex-col space-y-1">
          <Label>Distrito</Label>
          <Select
            value={registerData.district}
            onValueChange={(value) =>
              setRegisterData({ ...registerData, district: value })
            }
            disabled={isLoading || !registerData.province}
          >
            <SelectTrigger className={errors.district ? "border-red-500" : ""}>
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
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={registerData.password}
              onChange={(e) =>
                setRegisterData({ ...registerData, password: e.target.value })
              }
              disabled={isLoading}
              className={errors.password ? "border-red-500 pr-10" : "pr-10"}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Mínimo 6 caracteres, una letra minúscula y un número.
          </p>
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password}</p>
          )}
        </div>

        {/* Confirmación */}
        <div className="flex flex-col space-y-1">
          <Label htmlFor="register-confirm">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="register-confirm"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={registerData.confirmPassword}
              onChange={(e) =>
                setRegisterData({
                  ...registerData,
                  confirmPassword: e.target.value,
                })
              }
              disabled={isLoading}
              className={
                errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"
              }
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
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
