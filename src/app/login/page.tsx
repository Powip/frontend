"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Label from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import Link from "next/link";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { redirect } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  surname: string;
  phone_number: string;
  identity_document: string;
  email: string;
  password: string;
  confirmPassword: string;
  district: string;
  address: string;
}
/* 
Validar Inputs
Mostrar errores o notificaciones
validar contraseñas iguales
validar contraseña fuerte
*/
export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState<RegisterData>({
    name: "",
    surname: "",
    phone_number: "",
    identity_document: "",
    email: "",
    password: "",
    confirmPassword: "",
    district: "",
    address: "",
  });

  const handleSocialLogin = (provider: string) => {
    console.log(`[v0] Logging in with ${provider}`);
    // Handle social login
  };

  const handleOnLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:8080/auth/login",
        loginData
      );
      if (response.status === 200) {
        toast.success("Inicio de sesión exitoso");
        redirect("/dashboard");
      }
    } catch (error) {
      toast.error("Error al iniciar sesión");
    }
  };

  const handleOnRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:8080/auth/register");
    } catch (error) {}
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          {/* <Image
          src="/powip-logo.jpeg"
          alt="Powip"
          width={64}
          height={64}
          className="rounded-xl"
        /> */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">
              Bienvenido a Powip
            </h1>
            <p className="text-sm text-muted-foreground">
              Sistema de gestión empresarial
            </p>
          </div>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Accede a tu cuenta</CardTitle>
            <CardDescription>
              Inicia sesión o crea una cuenta nueva
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="register">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      <Link
                        href="/recuperar-contrasena"
                        className="text-xs text-primary hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <Input
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    onClick={handleOnLogin}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      O continúa con
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => handleSocialLogin("google")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => handleSocialLogin("facebook")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => handleSocialLogin("outlook")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.59q0-.48.33-.8.33-.32.8-.32h14.38q.46 0 .8.33.32.33.32.8V12zm-6.5-5.13q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3V6.87zm0 2.5q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3V9.37zm0 2.5q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3v-1.13zm0 2.5q0-.17-.13-.3-.12-.13-.3-.13H7.06q-.17 0-.3.13-.12.13-.12.3v1.13q0 .17.12.3.13.13.3.13h10.01q.17 0 .3-.13.13-.13.13-.3v-1.13z" />
                    </svg>
                    Outlook
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre y Apellido */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-name">Nombre</Label>
                    <Input
                      value={registerData.name}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          name: e.target.value,
                        })
                      }
                      id="register-name"
                      type="text"
                      placeholder="Juan"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-surname">Apellido</Label>
                    <Input
                      value={registerData.surname}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          surname: e.target.value,
                        })
                      }
                      id="register-surname"
                      type="text"
                      placeholder="Pérez"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Documento y Teléfono */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-document">
                      Documento de Identidad
                    </Label>
                    <Input
                      value={registerData.identity_document}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          identity_document: e.target.value,
                        })
                      }
                      id="register-document"
                      type="text"
                      placeholder="12345678"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-phone">Número de Teléfono</Label>
                    <Input
                      value={registerData.phone_number}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          phone_number: e.target.value,
                        })
                      }
                      id="register-phone"
                      type="text"
                      placeholder="12345678"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Distrito y Dirección */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-district">Distrito</Label>
                    <Input
                      value={registerData.district}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          district: e.target.value,
                        })
                      }
                      id="register-district"
                      type="text"
                      placeholder="Miraflores"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-address">Dirección</Label>
                    <Input
                      value={registerData.address}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          address: e.target.value,
                        })
                      }
                      id="register-address"
                      type="text"
                      placeholder="Av. Siempre Viva 123"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Correo electrónico */}
                  <div className="flex flex-col space-y-2 md:col-span-2">
                    <Label htmlFor="register-email">Correo electrónico</Label>
                    <Input
                      value={registerData.email}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          email: e.target.value,
                        })
                      }
                      id="register-email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Contraseña y Confirmación */}
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-password">Contraseña</Label>
                    <Input
                      value={registerData.password}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          password: e.target.value,
                        })
                      }
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="register-confirm">
                      Confirmar contraseña
                    </Label>
                    <Input
                      value={registerData.confirmPassword}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          confirmPassword: e.target.value,
                        })
                      }
                      id="register-confirm"
                      type="password"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  {/* Botón de crear cuenta */}
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? "Creando cuenta..." : "Crear cuenta"}
                    </Button>
                  </div>
                </form>

                {/* Separador y botones sociales */}
                <div className="relative md:col-span-2">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      O regístrate con
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-2 md:col-span-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => handleSocialLogin("google")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {/* SVG Google */}
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

                <p className="text-center text-xs text-muted-foreground md:col-span-2">
                  Al registrarte, aceptas nuestros{" "}
                  <Link
                    href="/terminos"
                    className="text-primary hover:underline"
                  >
                    Términos de Servicio
                  </Link>{" "}
                  y{" "}
                  <Link
                    href="/privacidad"
                    className="text-primary hover:underline"
                  >
                    Política de Privacidad
                  </Link>
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
