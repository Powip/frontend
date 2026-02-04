"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegisterForm from "@/components/forms/RegisterForm";
import LoginForm from "@/components/forms/LoginForm";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-950 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Image
            src="/logo_icon.png"
            alt="Powip Logo"
            width={64}
            height={64}
            className="rounded-xl"
          />
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
                <LoginForm />
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <RegisterForm />
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t border-border flex justify-center">
              <Link
                href="https://powip.lat"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a la página principal
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
