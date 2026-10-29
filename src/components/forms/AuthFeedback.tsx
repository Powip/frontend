import { CircleAlert } from "lucide-react";
import styles from "./auth-form.module.css";

export { notifyAuthError } from "@/lib/authToast";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={styles.error}>
      <CircleAlert size={14} aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

export function AuthErrorNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.errorNotice} role="alert" aria-atomic="true">
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <p className={styles.errorTitle}>{title}</p>
        <p className={styles.errorMessage}>{message}</p>
      </div>
    </div>
  );
}
