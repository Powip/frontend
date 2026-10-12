import {
  Coins,
  FileText,
  House,
  type LucideIcon,
  MapPin,
  MessageSquare,
  ReceiptText,
  Store,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { WHATSAPP_RULE_KEYS, type WhatsAppRuleKey } from "@/features/whatsapp/enums/whatsapp.enums";

export const RULE_ICONS: Record<WhatsAppRuleKey, LucideIcon> = {
  [WHATSAPP_RULE_KEYS.GUIDE_CREATED]: FileText,
  [WHATSAPP_RULE_KEYS.IN_TRANSIT]: Truck,
  [WHATSAPP_RULE_KEYS.AT_AGENCY]: Store,
  [WHATSAPP_RULE_KEYS.OUT_FOR_DELIVERY]: MapPin,
  [WHATSAPP_RULE_KEYS.DELIVERED]: House,
  [WHATSAPP_RULE_KEYS.INCIDENT]: TriangleAlert,
  [WHATSAPP_RULE_KEYS.INVOICE_ISSUED]: ReceiptText,
  [WHATSAPP_RULE_KEYS.DELIVERY_SURVEY]: MessageSquare,
  [WHATSAPP_RULE_KEYS.COD_BALANCE]: Coins,
};
