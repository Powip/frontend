"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { auth, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // ⏳ esperamos rehidratación

    if (auth) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [auth, loading, router]);

  return null;
}
