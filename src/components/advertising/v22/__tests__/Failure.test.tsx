import { act, render, screen } from "@testing-library/react";
import { Failure } from "../shared";

jest.mock("../context", () => ({ useAdsV22: jest.fn() }));

function providerError(status: number, reason: string, retryAfterSeconds: number) {
  return {
    isAxiosError: true,
    response: { status, data: { message: "Meta requiere esperar.", reason, retryAfterSeconds } },
  };
}

describe("Provider retry feedback", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("counts down a provider rate limit before allowing a manual retry", () => {
    const retry = jest.fn();
    render(<Failure error={providerError(429, "META_RATE_LIMIT", 2)} retry={retry} />);
    expect(screen.getByRole("status")).toHaveTextContent("00:02");
    expect(screen.getByRole("button", { name: "Volver a intentar" })).toBeDisabled();
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Volver a intentar" })).toBeEnabled();
    expect(retry).not.toHaveBeenCalled();
  });

  it("retries a transient read once after its real cooldown and never repeats a mutation", () => {
    const retry = jest.fn();
    const error = providerError(503, "META_UNAVAILABLE", 300);
    const view = render(<Failure error={error} retry={retry} />);
    act(() => jest.advanceTimersByTime(299000));
    expect(retry).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("00:01");
    act(() => jest.advanceTimersByTime(1000));
    expect(retry).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(300000));
    expect(retry).toHaveBeenCalledTimes(1);
    view.rerender(<Failure error={providerError(503, "META_REPORT_PENDING", 3)} />);
    act(() => jest.advanceTimersByTime(3000));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers reconnection when Meta authorization expired", () => {
    render(<Failure error={providerError(409, "META_TOKEN_EXPIRED", 0)} />);
    expect(
      screen.getByRole("link", { name: "Revisar conexión y permisos de Meta" }),
    ).toHaveAttribute("href", "/publicidad/configuracion?section=accounts");
  });
});
