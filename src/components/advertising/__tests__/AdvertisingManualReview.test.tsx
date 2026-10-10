import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvertisingManualReview } from "../AdvertisingManualReview";
import { type AdvertisingSnapshot, formatAdvertisingMoney } from "../advertising-model";

// Radix uses browser APIs that jsdom does not provide. The controls remain real.
beforeAll(() => {
  if (!window.PointerEvent) {
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent });
  }
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: jest.fn(),
  });
  if (!window.ResizeObserver) {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
});

function createSnapshot(): AdvertisingSnapshot {
  return {
    accounts: [
      {
        id: "meta-pen",
        provider: "meta",
        name: "Lima",
        externalId: "101",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        updatedAt: "2026-10-08T14:30:00-05:00",
      },
      {
        id: "tiktok-pen",
        provider: "tiktok",
        name: "TikTok Perú",
        externalId: "202",
        currency: "PEN",
        timeZone: "America/Lima",
        enabled: true,
        updatedAt: "2026-10-08T14:30:00-05:00",
      },
      {
        id: "meta-usd",
        provider: "meta",
        name: "Internacional",
        externalId: "303",
        currency: "USD",
        timeZone: "America/New_York",
        enabled: false,
        updatedAt: "2026-10-08T14:30:00-05:00",
      },
    ],
    days: [
      { accountId: "meta-pen", date: "2026-10-08", amountMinor: 10000 },
      { accountId: "tiktok-pen", date: "2026-10-08", amountMinor: 5000 },
      { accountId: "meta-usd", date: "2026-10-08", amountMinor: 1500 },
    ],
    manualRecords: [
      {
        id: "manual-1",
        date: "2026-10-08",
        amountMinor: 10000,
        currency: "PEN",
        status: "pending",
        // Even a prior suggested link must not select or confirm the account.
        importedAccountId: "meta-pen",
      },
    ],
    providers: {
      meta: { available: true, status: "connected" },
      tiktok: { available: true, status: "connected" },
    },
    today: "2026-10-08",
  };
}

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Revisar gasto" }));
  return screen.getByRole("dialog", { name: "Compara los gastos" });
}

async function selectAccount(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const trigger = screen.getByRole("combobox", { name: "Cuenta importada para comparar" });
  // Exercise the real Select through its keyboard interaction.
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name }));
}

describe("AdvertisingManualReview", () => {
  it("requires an explicit account and confirmation even when date and amount match", async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();
    render(<AdvertisingManualReview snapshot={createSnapshot()} onResolve={onResolve} isDemo />);
    const dialog = await openReview(user);
    const submit = within(dialog).getByRole("button", { name: "Confirmar mismo gasto" });

    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Elige una cuenta");
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(submit).toBeDisabled();

    await selectAccount(user, /Lima · PEN/);
    const consent = screen.getByRole("checkbox", {
      name: "Confirmo que es el mismo gasto de esta cuenta y día.",
    });
    expect(consent).not.toBeChecked();
    expect(submit).toBeDisabled();
    expect(onResolve).not.toHaveBeenCalled();

    await user.click(consent);
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith("manual-1", "meta-pen");
  });

  it("clears confirmation when the user changes the compared account", async () => {
    const user = userEvent.setup();
    const onResolve = jest.fn();
    render(<AdvertisingManualReview snapshot={createSnapshot()} onResolve={onResolve} isDemo />);
    await openReview(user);
    await selectAccount(user, /Lima · PEN/);
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Confirmar mismo gasto" })).toBeEnabled();

    await selectAccount(user, /TikTok Perú · PEN/);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar mismo gasto" })).toBeDisabled();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it.each(["unknown", "different"])(
    "does not resolve when the currency is %s",
    async (currency) => {
      const user = userEvent.setup();
      const snapshot = createSnapshot();
      if (currency === "unknown") snapshot.manualRecords[0].currency = null;
      const onResolve = jest.fn();
      render(<AdvertisingManualReview snapshot={snapshot} onResolve={onResolve} isDemo />);
      await openReview(user);
      await selectAccount(user, currency === "unknown" ? /Lima · PEN/ : /Internacional · USD/);

      const submit = screen.getByRole("button", { name: "Confirmar mismo gasto" });
      expect(submit).toBeDisabled();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      await user.click(submit);
      expect(onResolve).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent(
        currency === "unknown"
          ? "Falta confirmar la moneda original"
          : "Las monedas son diferentes",
      );
    },
  );

  it.each(["pending", "missing"])(
    "keeps an imported day that is %s unavailable for review",
    async (availability) => {
      const user = userEvent.setup();
      const snapshot = createSnapshot();
      if (availability === "pending") snapshot.days[0].amountMinor = null;
      else snapshot.days = snapshot.days.filter((day) => day.accountId !== "meta-pen");
      const onResolve = jest.fn();
      render(<AdvertisingManualReview snapshot={snapshot} onResolve={onResolve} isDemo />);
      await openReview(user);
      await selectAccount(user, /Lima · PEN/);

      const submit = screen.getByRole("button", { name: "Confirmar mismo gasto" });
      expect(submit).toBeDisabled();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("No hay gasto importado disponible");
      await user.click(submit);
      expect(onResolve).not.toHaveBeenCalled();
    },
  );

  it("reads the resolved status and current imported amount from the updated snapshot", async () => {
    const user = userEvent.setup();
    const snapshot = createSnapshot();
    const onResolve = jest.fn();
    const { rerender } = render(
      <AdvertisingManualReview snapshot={snapshot} onResolve={onResolve} isDemo />,
    );
    await openReview(user);
    await selectAccount(user, /Lima · PEN/);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Confirmar mismo gasto" }));
    expect(onResolve).toHaveBeenCalledWith("manual-1", "meta-pen");

    const updated = createSnapshot();
    updated.manualRecords[0].status = "represented";
    updated.manualRecords[0].importedAccountId = "meta-pen";
    updated.days[0].amountMinor = 12550;
    rerender(<AdvertisingManualReview snapshot={updated} onResolve={onResolve} isDemo />);

    const resolvedDialog = screen.getByRole("dialog", { name: "Gasto revisado" });
    expect(
      within(resolvedDialog).getByText("Este registro no añade otro gasto."),
    ).toBeInTheDocument();
    expect(within(resolvedDialog).getByText(/Se cuenta una sola vez:/)).toHaveTextContent(
      formatAdvertisingMoney(12550, "PEN").replace(/\s/g, " "),
    );
    expect(
      within(resolvedDialog).queryByRole("button", { name: "Confirmar mismo gasto" }),
    ).not.toBeInTheDocument();
    expect(within(resolvedDialog).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("allows comparison without offering a mutation when no handler is provided", async () => {
    const user = userEvent.setup();
    render(<AdvertisingManualReview snapshot={createSnapshot()} isDemo={false} />);
    const dialog = await openReview(user);
    await selectAccount(user, /Lima · PEN/);

    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Confirmar mismo gasto" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Vista de consulta/)).toBeInTheDocument();
  });
});
