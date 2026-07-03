"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface AdminPeriodContextValue {
  fromDate: string;
  toDate: string;
  setPeriod: (from: string, to: string) => void;
}

const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null);

export function AdminPeriodProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [fromDate, setFromDate] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const setPeriod = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  };

  return (
    <AdminPeriodContext.Provider value={{ fromDate, toDate, setPeriod }}>
      {children}
    </AdminPeriodContext.Provider>
  );
}

export function useAdminPeriod() {
  const ctx = useContext(AdminPeriodContext);
  if (!ctx) throw new Error("useAdminPeriod must be used inside AdminPeriodProvider");
  return ctx;
}
