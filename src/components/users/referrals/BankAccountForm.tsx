"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { usersTheme } from "../usersTheme";

interface BankAccountFormProps {
  bankLabel: string;
  pendingNoticeId: string;
}

export function BankAccountForm({ bankLabel, pendingNoticeId }: BankAccountFormProps) {
  const fieldId = useId();
  const [values, setValues] = useState({
    accountNumber: "",
    accountType: "savings",
    holderName: "",
    holderDocument: "",
    cci: "",
    confirmationEmail: "",
  });
  const update = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((current) => ({ ...current, [key]: e.target.value }));

  return (
    <form aria-label={`Cuenta bancaria ${bankLabel}`} onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-account`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Número de cuenta
          </label>
          <Input
            id={`${fieldId}-account`}
            placeholder="Ej: 191-12345678-0-01"
            value={values.accountNumber}
            onChange={update("accountNumber")}
            className={`bg-white dark:bg-transparent ${usersTheme.input}`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-type`} className={usersTheme.fieldLabel}>
            Tipo de cuenta
          </label>
          <select
            id={`${fieldId}-type`}
            value={values.accountType}
            onChange={update("accountType")}
            className={`h-9 w-full bg-white px-3 dark:bg-transparent ${usersTheme.input}`}
          >
            <option value="savings">Cuenta de ahorros</option>
            <option value="checking">Cuenta corriente</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-holder`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Titular de la cuenta
          </label>
          <Input
            id={`${fieldId}-holder`}
            placeholder="Nombre completo o razón social"
            value={values.holderName}
            onChange={update("holderName")}
            className={`bg-white dark:bg-transparent ${usersTheme.input}`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-document`} className={usersTheme.fieldLabel}>
            DNI / RUC del titular
          </label>
          <Input
            id={`${fieldId}-document`}
            placeholder="Número de documento"
            value={values.holderDocument}
            onChange={update("holderDocument")}
            className={`bg-white dark:bg-transparent ${usersTheme.input}`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-cci`} className={usersTheme.fieldLabel}>
            CCI (cuenta interbancaria)
          </label>
          <Input
            id={`${fieldId}-cci`}
            placeholder="002-191-..."
            maxLength={20}
            value={values.cci}
            onChange={update("cci")}
            className={`bg-white dark:bg-transparent ${usersTheme.input}`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-email`} className={usersTheme.fieldLabel}>
            Email de confirmación
          </label>
          <Input
            id={`${fieldId}-email`}
            type="email"
            placeholder="para notificarte el abono"
            value={values.confirmationEmail}
            onChange={update("confirmationEmail")}
            className={`bg-white dark:bg-transparent ${usersTheme.input}`}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled
        aria-describedby={pendingNoticeId}
        className={`${usersTheme.primaryButton} w-full justify-center`}
      >
        Guardar cuenta bancaria
      </button>
    </form>
  );
}
