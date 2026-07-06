"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface FormValues {
  name: string;
  surname: string;
  email: string;
  password: string;
  phone: string;
}

interface OnboardingRegisterFormProps {
  onSubmit: (data: FormValues) => Promise<void>;
  isLoading: boolean;
}

export default function OnboardingRegisterForm({
  onSubmit,
  isLoading,
}: OnboardingRegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onBlur",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            placeholder="Juan"
            aria-invalid={!!errors.name}
            {...register("name", {
              required: "El nombre es requerido",
              minLength: { value: 2, message: "Al menos 2 caracteres" },
            })}
          />
          {errors.name && (
            <p className="text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="surname">Apellido</Label>
          <Input
            id="surname"
            placeholder="Pérez"
            aria-invalid={!!errors.surname}
            {...register("surname", {
              required: "El apellido es requerido",
              minLength: { value: 2, message: "Al menos 2 caracteres" },
            })}
          />
          {errors.surname && (
            <p className="text-xs text-red-500">{errors.surname.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          placeholder="juan@ejemplo.com"
          aria-invalid={!!errors.email}
          {...register("email", {
            required: "El email es requerido",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Ingresa un email válido",
            },
          })}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Min. 6 caracteres"
            aria-invalid={!!errors.password}
            className="pr-10"
            {...register("password", {
              required: "La contraseña es requerida",
              minLength: { value: 6, message: "Al menos 6 caracteres" },
              validate: (value) =>
                /(?=.*[a-z])(?=.*\d)/.test(value) ||
                "Debe tener una letra minúscula y un número",
            })}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Teléfono</Label>
        <div className="flex gap-2">
          <div className="bg-gray-50 border border-gray-200 border-r-0 px-3 py-2.5 rounded-l-md text-gray-500 text-sm flex items-center whitespace-nowrap">
            🇵🇪 +51
          </div>
          <Input
            id="phone"
            type="tel"
            placeholder="987654321"
            aria-invalid={!!errors.phone}
            {...register("phone", {
              required: "El teléfono es requerido",
              minLength: { value: 9, message: "Debe tener 9 dígitos" },
              maxLength: { value: 9, message: "Debe tener 9 dígitos" },
              pattern: { value: /^\d+$/, message: "Solo se permiten números" },
            })}
          />
        </div>
        {errors.phone && (
          <p className="text-xs text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-[#4F3A96] hover:bg-[#3d2d78] text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          "Crear cuenta y continuar"
        )}
      </Button>
    </form>
  );
}
