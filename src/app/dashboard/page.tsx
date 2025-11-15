"use client";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { auth, logout } = useAuth();
  const router = useRouter();

  /* useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth]);

  if (!auth) return null; */

  return (
    <div className="h-screen flex flex-col">
      <Header title="Dashboard" />
      <div className="flex-1 overflow-hidden">
        <Stats />
      </div>
    </div>
  );
}
