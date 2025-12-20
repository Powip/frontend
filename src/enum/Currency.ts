export enum Currency {
  PEN = "PEN", // Sol peruano
  USD = "USD", // Dólar estadounidense
  // ARS = "ARS",
}
export interface CurrencyOption {
  value: Currency;
  label: string;
}
export const currencyOptions: CurrencyOption[] = [
  { value: Currency.USD, label: "USD - Dólar Estadounidense" },
  { value: Currency.PEN, label: "PEN - Sol Peruano" },
];
