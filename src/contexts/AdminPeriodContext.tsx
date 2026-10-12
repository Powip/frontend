"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

interface AdminPeriodContextValue {
  fromDate: string;
  toDate: string;
  setPeriod: (from: string, to: string) => void;
}

const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null);

export function AdminPeriodProvider({
  children,
  initialRange,
}: {
  children: ReactNode;
  initialRange?: { from: string; to: string };
}) {
  const now = new Date();
  const [fromDate, setFromDate] = useState(
    () => initialRange?.from ?? format(startOfMonth(now), "yyyy-MM-dd"),
  );
  const [toDate, setToDate] = useState(
    () => initialRange?.to ?? format(endOfMonth(now), "yyyy-MM-dd"),
  );

  const setPeriod = useCallback((from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
  }, []);

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
