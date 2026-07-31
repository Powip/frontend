import { LogOperation } from "@/api/sales/types/order.types";

export interface OrderLog {
  id: number;

  operation: LogOperation;
  comments?: string;

  userId: string | null;
  userName: string | null;

  data: Record<string, unknown>;

  isSystemGenerated: boolean;

  timestamp: Date;
}
