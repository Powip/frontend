"use client";
import { Stats } from "@/components/dashboard/stats";
import Header from "@/components/header/Header";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {

  const router = useRouter();

  const { auth, logout } = useAuth();
  useEffect(() => {
    if (!auth) router.push("/login");
  }, [auth, router]);

  if (!auth) return null;

  return (
    <div className="h-full flex flex-col">
      <Header />
      <div className="flex-1 overflow-hidden">
        <Stats />
      </div>
    </div>
  );
}
