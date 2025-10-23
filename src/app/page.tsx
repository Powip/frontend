"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // ejemplo de redirect
    const loggedIn = false;
    if (!loggedIn) {
      router.push("/login");
    }
  }, []);

  return (
    <div>
      <h1>Home</h1>
      <Link href="/ventas">Ventas</Link>
    </div>
  );
}
