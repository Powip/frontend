interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  durationInDays: number;
}
export interface ISubscription {
  id: string;
  userId: string;
  plan: Plan;
  startDate: string;
  endDate: string;
  status: string;
  autoRenewal: boolean;
}
