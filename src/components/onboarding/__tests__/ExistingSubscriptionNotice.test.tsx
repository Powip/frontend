import { render, screen } from "@testing-library/react";
import type { SubscriptionMe } from "@/types/onboarding";
import ExistingSubscriptionNotice from "../ExistingSubscriptionNotice";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const subscription = (gateway: SubscriptionMe["gateway"]): SubscriptionMe => ({
  id: "s1",
  status: "ACTIVE",
  gateway,
  autoRenewal: false,
  startDate: "2026-09-28",
  endDate: "2026-10-28",
  plan: { id: "basic", name: "Basic", price: 99, durationInDays: 30 },
  addOns: [],
});

it("a un plan que no es de Flow le ofrece pasarse a Flow", () => {
  render(<ExistingSubscriptionNotice subscription={subscription("MANUAL")} continueHref="/" refreshSession={jest.fn()} />);

  expect(screen.getByRole("link", { name: "Pasarme a Flow" })).toHaveAttribute("href", "/pasate-a-flow");
});

it("a un plan de Flow no le ofrece nada más", () => {
  render(<ExistingSubscriptionNotice subscription={subscription("FLOW")} continueHref="/" refreshSession={jest.fn()} />);

  expect(screen.queryByRole("link", { name: "Pasarme a Flow" })).not.toBeInTheDocument();
});
