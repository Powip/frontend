import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ReactNode } from "react";
import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.mobileHeader}>
        <Link
          href="https://powip.lat"
          className={styles.mobileBack}
          aria-label="Volver a la página principal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <Image
          src="/logo-powip-text.svg"
          alt="Powip"
          width={150}
          height={48}
          priority
          className={styles.mobileLogo}
        />
      </header>

      <aside className={styles.brand} aria-label="Powip para tu negocio">
        <Image
          src="/logo-powip-text.svg"
          alt="Powip"
          width={160}
          height={52}
          priority
          className={styles.brandLogo}
        />

        <div className={styles.brandIntro}>
          <h2 className={styles.brandTitle}>
            Tu negocio,
            <br />
            en un solo lugar.
          </h2>
          <p className={styles.brandDescription}>
            Gestiona tus pedidos, inventario y envíos desde un mismo panel.
          </p>
        </div>

        <div className={styles.illustration} aria-hidden="true">
          <svg
            viewBox="426 240 592 970"
            width={592}
            height={970}
            aria-hidden="true"
            focusable="false"
            className={styles.mascot}
          >
            <image href="/mascota-saludando.svg" width={1500} height={1500} />
          </svg>
        </div>
      </aside>

      <div className={styles.content}>
        {children}
        <Link href="https://powip.lat" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la página principal
        </Link>
      </div>
    </div>
  );
}
