"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Bell, Users, Key, Gift } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import UsuariosTab from "./components/UsuariosTab";
import RolesPermisosTab from "./components/RolesPermisosTab";
import ReferidosCobroTab from "./components/ReferidosCobroTab";

export default function UsuariosRolesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab") || "usuarios";
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);

    router.replace(`/administracion/usuarios?tab=${value}`);
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios y Roles</h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

            <Input
              type="search"
              placeholder="Buscar usuario..."
              className="w-64 border-slate-200 bg-slate-50 pl-8"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-slate-50"
          >
            <Bell className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex h-full w-full flex-col"
        >
          <div className="mb-6 border-b border-slate-200">
            <TabsList className="h-auto w-full justify-start space-x-6 rounded-none border-b-0 bg-transparent p-0">
              <TabsTrigger
                value="usuarios"
                className="rounded-none px-1 pb-3 pt-2 font-semibold text-slate-500 hover:text-slate-700 data-[state=active]:border-b-2 data-[state=active]:border-b-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none"
              >
                <Users className="mr-2 h-4 w-4" />
                Usuarios (12)
              </TabsTrigger>

              <TabsTrigger
                value="roles"
                className="rounded-none px-1 pb-3 pt-2 font-semibold text-slate-500 hover:text-slate-700 data-[state=active]:border-b-2 data-[state=active]:border-b-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none"
              >
                <Key className="mr-2 h-4 w-4 text-amber-400" />
                Roles y permisos (6)
              </TabsTrigger>

              <TabsTrigger
                value="referidos"
                className="rounded-none px-1 pb-3 pt-2 font-semibold text-slate-500 hover:text-slate-700 data-[state=active]:border-b-2 data-[state=active]:border-b-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none"
              >
                <Gift className="mr-2 h-4 w-4 text-red-500" />
                Referidos y cobro
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="usuarios" className="m-0 h-full">
              <UsuariosTab />
            </TabsContent>

            <TabsContent value="roles" className="m-0 h-full">
              <RolesPermisosTab />
            </TabsContent>

            <TabsContent value="referidos" className="m-0 h-full">
              <ReferidosCobroTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
