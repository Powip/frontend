"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Filters = {
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  companyId?: string;
};

type FilterContextType = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<Filters>({});

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters debe usarse dentro de FilterProvider");
  }
  return context;
};
