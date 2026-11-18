import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axiosAuth from "@/lib/axiosAuth";
import ScheduledDeliverySection from "../ScheduledDeliverySection";

// FEAT-24 SEC: `PATCH order-header/:id` pide el JWT de la empresa: la entrega se confirma con la sesión (axiosAuth).
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { patch: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const authPatch = jest.mocked(axiosAuth.patch);

test("confirmar la entrega manda el PATCH con la sesión", async () => {
  process.env.NEXT_PUBLIC_API_VENTAS = "http://ventas";
  authPatch.mockResolvedValue({ data: {} });
  const onUpdated = jest.fn();
  render(
    <ScheduledDeliverySection
      orderId="order-1"
      status="LLAMADO"
      callbackAt="2026-11-20T15:00:00.000Z"
      callStatus="SCHEDULED"
      onUpdated={onUpdated}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /confirmar entrega/i }));
  await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  expect(authPatch).toHaveBeenCalledWith("http://ventas/order-header/order-1", { callStatus: "CONFIRMED" });
});
