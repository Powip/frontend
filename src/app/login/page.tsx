import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegisterForm from "@/components/forms/RegisterForm";
import LoginForm from "@/components/forms/LoginForm";
import Image from "next/image";
import { ArrowLeft, Shield, Zap, Users } from "lucide-react";
import Link from "next/link";

const FEATURES = [
  { icon: Shield, text: "Conexión segura SSL" },
  { icon: Zap, text: "Acceso inmediato a tu panel" },
  { icon: Users, text: "+1,200 negocios confían en Powip" },
];

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex flex-col lg:grid lg:grid-cols-2"
      style={{ background: "#f7f5ff" }}
    >
      <div className="lg:hidden bg-[#4F3A96] px-4 py-2">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-powip-text.svg"
            alt="Powip"
            width={100}
            height={40}
            className="h-auto brightness-0 invert"
            priority
          />
        </div>
      </div>

      <div
        className="hidden lg:flex flex-col px-10 py-12 h-screen relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #3d2d78 0%, #4F3A96 55%, #6a4fc4 100%)",
        }}
      >
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.3)" }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full opacity-10"
          style={{ background: "rgba(255,255,255,0.2)" }}
        />

        <div className="flex justify-start items-center w-full z-10">
          <Image
            src="/logo-powip-text.svg"
            alt="Logo Powip"
            width={320}
            height={100}
            priority
            className="w-auto h-10 brightness-0 invert"
          />
        </div>

        <div className="mt-12 flex flex-col gap-8 z-10">
          <div>
            <h2 className="text-white font-black text-4xl leading-tight mb-4">
              Bienvenido de vuelta
            </h2>
            <p className="text-white/70 text-base leading-relaxed max-w-md">
              Gestiona tus pedidos, inventario y couriers desde un solo panel.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white/80" />
                </div>
                <span className="text-white/75 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <Image
          src="/mascota-saludando.svg"
          alt=""
          aria-hidden="true"
          width={800}
          height={800}
          priority
          className="absolute -bottom-[100px] right-0 w-[500px] h-auto pointer-events-none select-none"
        />
      </div>

      <div className="flex flex-col items-center justify-center px-5 py-12 bg-transparent">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-black text-gray-900">
              Bienvenido a Powip
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Inicia sesión o crea una cuenta nueva para continuar.
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 mb-8">
              <TabsTrigger
                value="login"
                className="data-[state=active]:bg-[#4F3A96] data-[state=active]:text-white"
              >
                Iniciar sesión
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="data-[state=active]:bg-[#4F3A96] data-[state=active]:text-white"
              >
                Registrarse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="w-full max-w-xl mx-auto">
                <LoginForm />
              </div>
            </TabsContent>

            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Link
              href="https://powip.lat"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a la página principal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
