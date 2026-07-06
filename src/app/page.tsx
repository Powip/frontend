"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { auth, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!auth) {
      router.replace("/login");
      return;
    }
    if (auth.company === null && !auth.user.companyId) {
      router.replace("/new-company");
      return;
    }
    // TEMPORAL: restricción de suscripción deshabilitada
    // if (auth.subscription === false) {
    //   router.replace("/sin-plan");
    //   return;
    // }
    router.replace("/dashboard");
  }, [auth, loading, router]);

  return null;
}
