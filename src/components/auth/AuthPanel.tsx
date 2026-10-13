import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import LoginForm from "@/components/forms/LoginForm";
import styles from "./auth-layout.module.css";

export default function AuthPanel({ registration }: { registration?: ReactNode }) {
  const isRegister = Boolean(registration);

  return (
    <section
      className={styles.card}
      data-view={isRegister ? "register" : "login"}
      aria-label="Acceso a Powip"
    >
      <div className={styles.tabs}>
        <nav className={styles.tabList} aria-label="Accede o crea tu cuenta">
          <Link
            href="/login"
            className={styles.tabTrigger}
            data-state={isRegister ? "inactive" : "active"}
            aria-current={isRegister ? undefined : "page"}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/onboarding"
            className={styles.tabTrigger}
            data-state={isRegister ? "active" : "inactive"}
            aria-current={isRegister ? "page" : undefined}
          >
            Crear cuenta
          </Link>
        </nav>

        <div className={styles.tabContent} data-state="active">
          <header className={styles.formHeader}>
            <h1 className={styles.formTitle}>
              {isRegister ? "Crea tu cuenta" : "Qué bueno verte de nuevo"}
            </h1>
            <p className={styles.formDescription}>
              {isRegister
                ? "Completa tus datos para crear tu cuenta."
                : "Ingresa a tu cuenta y continúa con tu negocio."}
            </p>
          </header>
          <div className={isRegister ? styles.registerBody : styles.loginBody}>
            {isRegister ? registration : <LoginForm />}
          </div>
          {!isRegister && (
            <p className={styles.secureNote}>
              <LockKeyhole size={14} aria-hidden="true" />
              Tu información está protegida
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
