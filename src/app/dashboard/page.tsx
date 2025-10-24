"use client";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { auth, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth]);

  if (!auth) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-green mb-8">Home</h1>
      <div className="flex direction-col space-x-6">
        <Link href="/ventas" className="text-blue-500 hover:underline text-xl">
          Ventas
        </Link>
        <Link href="/pedidos" className="text-blue-500 hover:underline text-xl">
          Pedidos
        </Link>
        <Link
          href="/productos"
          className="text-blue-500 hover:underline text-xl"
        >
          Productos
        </Link>
        <Link href="/login" className="text-blue-500 hover:underline text-xl">
          Login
        </Link>
      </div>
    </div>
  );
}
