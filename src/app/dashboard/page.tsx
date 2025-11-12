"use client";
import { Stats } from "@/components/dashboard/stats";
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

  if (!auth) return null;
 */
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-green mb-8">Home</h1>
      <div className="flex direction-col space-x-6">

        <Stats  />
        
      </div>
    </div>
  );
}
