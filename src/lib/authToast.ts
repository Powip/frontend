import { toast } from "sonner";
import styles from "../styles/auth-toast.module.css";

/** One visible notification per authentication attempt, including repeated submits. */
export function notifyAuthError(title: string, description: string) {
  return toast.error(title, {
    id: "auth-feedback",
    position:
      typeof window !== "undefined" && window.innerWidth >= 1024 ? "bottom-right" : "top-center",
    description,
    duration: 6000,
    closeButton: true,
    classNames: {
      toast: styles.toast,
      title: styles.title,
      description: styles.description,
    },
  });
}
