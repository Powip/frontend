"use client";

import React from "react";

interface SourceBadgeProps {
  source?: string | null;
}

const ShopifyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3 w-3 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M15.337 2.432a.528.528 0 0 0-.476-.046l-.002.001-.52.16-.286-.858a.528.528 0 0 0-.476-.322l-.002.001h-.001a.528.528 0 0 0-.527.461l-.153 1.12-.523.161a.528.528 0 0 0-.347.64l.004.012.44 1.318-1.253.387a.528.528 0 0 0-.347.64l.003.012.96 2.88-.95 8.312a.528.528 0 0 0 .387.558l5.274 1.406a.528.528 0 0 0 .641-.375l1.406-5.274a.528.528 0 0 0-.375-.641l-2.88-.768 1.92-5.76a.528.528 0 0 0-.32-.672zm-7.28 12.576L6.73 6.432H5.274L3.95 15.008l7.114 1.9z" />
  </svg>
);

const SheetsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3 w-3 fill-current"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M16 13H8M16 17H8M10 9H8" />
  </svg>
);

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source }) => {
  const normalizedSource = source?.toLowerCase();

  if (normalizedSource === "shopify") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#96bf48]/15 text-[#5a8a1a] border border-[#96bf48]/30"
        title="Pedido importado desde Shopify"
      >
        <ShopifyIcon />
        Shopify
      </span>
    );
  }

  if (normalizedSource === "google_sheets") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200"
        title="Pedido importado desde Google Sheets"
      >
        <SheetsIcon />
        Google Sheets
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border"
      title="Pedido creado manualmente en Powip"
    >
      Powip
    </span>
  );
};
