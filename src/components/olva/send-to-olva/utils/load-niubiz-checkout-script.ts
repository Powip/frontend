import "./niubiz-checkout.types";

const loading = new Map<string, Promise<void>>();

/**
 * Loads Niubiz's `checkout.js` once. The URL comes from the API, so only https is accepted.
 * A failed load is forgotten, so the next click tries again.
 */
export function loadNiubizCheckoutScript(url: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("El pago con tarjeta solo se abre en el navegador."));
  }

  if (!url.startsWith("https://")) {
    return Promise.reject(new Error("La dirección del formulario de pago no es segura."));
  }

  if (window.VisanetCheckout) return Promise.resolve();

  const pending = loading.get(url);

  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.src = url;
    script.async = true;
    script.onload = () => {
      if (window.VisanetCheckout) resolve();
      else reject(new Error("El formulario de pago no se inicializó."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("No se pudo cargar el formulario de pago."));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading.delete(url);
    throw error;
  });

  loading.set(url, promise);

  return promise;
}
