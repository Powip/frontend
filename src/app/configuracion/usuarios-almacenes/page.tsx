"use client";

import { HeaderConfig } from "@/components/header/HeaderConfig";
import UserWarehousesView from "@/components/warehouse-ops/users/UserWarehousesView";

// FEAT-24 H6 — Configuración › Usuarios y almacenes (solo el Administrador edita).
export default function UsuariosAlmacenesPage() {
  return (
    <div className="space-y-6">
      <HeaderConfig title="Usuarios y almacenes" description="Qué almacenes ve cada usuario y en cuáles mueve stock" />
      <UserWarehousesView />
    </div>
  );
}
