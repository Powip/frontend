"use client";

import { LockKeyhole } from "lucide-react";
import { useState } from "react";

import LoginForm from "@/components/forms/LoginForm";
import RegisterForm from "@/components/forms/RegisterForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from "./auth-layout.module.css";

export default function AuthPanel() {
  const [view, setView] = useState("login");

  return (
    <section className={styles.card} data-view={view} aria-label="Acceso a Powip">
      <Tabs value={view} onValueChange={setView} className={styles.tabs}>
        <TabsList className={styles.tabList} aria-label="Accede o crea tu cuenta">
          <TabsTrigger value="login" className={styles.tabTrigger}>
            Iniciar sesión
          </TabsTrigger>
          <TabsTrigger value="register" className={styles.tabTrigger}>
            Crear cuenta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className={styles.tabContent}>
          <header className={styles.formHeader}>
            <h1 className={styles.formTitle}>Qué bueno verte de nuevo</h1>
            <p className={styles.formDescription}>Ingresa a tu cuenta y continúa con tu negocio.</p>
          </header>
          <div className={styles.loginBody}>
            <LoginForm />
          </div>
          <p className={styles.secureNote}>
            <LockKeyhole size={14} aria-hidden="true" />
            Tu información está protegida
          </p>
        </TabsContent>

        <TabsContent value="register" className={styles.tabContent}>
          <header className={styles.formHeader}>
            <h1 className={styles.formTitle}>Crea tu cuenta</h1>
            <p className={styles.formDescription}>Completa tus datos para crear tu cuenta.</p>
          </header>
          <div className={styles.registerBody}>
            <RegisterForm />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
