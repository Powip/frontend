/** Niubiz `checkout.js` (VisaNet) as it is exposed on `window` once its script is loaded. */
export interface VisanetCheckoutConfig {
  sessiontoken: string;
  merchantid: string;
  channel: "web";
  /** Numeric, up to 12 digits. */
  purchasenumber: string;
  amount: number;
  expirationminutes: number;
  timeouturl: string;
  /** Endpoint that receives the transaction token to authorize the payment. Not documented by Olva yet. */
  action?: string;
  method?: "POST";
  /** Called by the form when it finishes. Its argument may carry tokens: never log it. */
  complete?: (params: unknown) => void;
}

export interface VisanetCheckoutApi {
  configure: (config: VisanetCheckoutConfig) => void;
  open: () => void;
}

declare global {
  interface Window {
    VisanetCheckout?: VisanetCheckoutApi;
  }
}
