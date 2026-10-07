"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { usersTheme } from "../usersTheme";

interface WalletFormProps {
  walletLabel: "Yape" | "Plin";
  pendingNoticeId: string;
}

export function WalletForm({ walletLabel, pendingNoticeId }: WalletFormProps) {
  const fieldId = useId();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [holderName, setHolderName] = useState("");

  return (
    <form aria-label={`Cuenta ${walletLabel}`} onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-phone`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Número de celular {walletLabel}
          </label>
          <div className="flex overflow-hidden rounded-[9px] border-[1.5px] border-[#e8e4f8] bg-white focus-within:border-[#4C2FB5] dark:border-border dark:bg-transparent">
            <span aria-hidden="true" className="border-r border-[#e8e4f8] bg-[#f7f6ff] px-[11px] py-[9px] text-xs text-[#8b87a3] dark:border-border dark:bg-muted">
              +51
            </span>
            <input
              id={`${fieldId}-phone`}
              inputMode="tel"
              placeholder="987 654 321"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-[11px] py-[9px] text-[13px] outline-none"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-holder`} className={`${usersTheme.fieldLabel} ${usersTheme.requiredMark}`}>
            Nombre en {walletLabel}
          </label>
          <Input
            id={`${fieldId}-holder`}
            placeholder={`Como aparece en ${walletLabel}`}
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
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
        Guardar {walletLabel}
      </button>
    </form>
  );
}
