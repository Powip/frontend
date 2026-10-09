"use client";

import {
  CalendarClock,
  FileText,
  Link2,
  type LucideIcon,
  MessagesSquare,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WHATSAPP_TAB_DEFINITIONS } from "@/features/whatsapp/constants/whatsapp-tabs";
import { WHATSAPP_TABS, type WhatsAppTab } from "@/features/whatsapp/enums/whatsapp.enums";
import { RULE_LINK_PARAMS } from "@/features/whatsapp/utils/rule-link.util";
import type { WhatsAppAccess } from "@/features/whatsapp/utils/whatsapp-access.util";
import {
  parseWhatsAppTab,
  readStoredWhatsAppTab,
  resolveWhatsAppTab,
  writeStoredWhatsAppTab,
} from "@/features/whatsapp/utils/whatsapp-tab.util";
import { CONVERSATION_THREAD_PARAM } from "./conversaciones/ConversationsTab";
import { WhatsAppTabPanel } from "./WhatsAppTabPanel";

const TAB_ICONS: Record<WhatsAppTab, LucideIcon> = {
  [WHATSAPP_TABS.CONNECTION]: Link2,
  [WHATSAPP_TABS.TEMPLATES]: FileText,
  [WHATSAPP_TABS.SCHEDULING]: CalendarClock,
  [WHATSAPP_TABS.CONVERSATIONS]: MessagesSquare,
  [WHATSAPP_TABS.HISTORY]: Send,
  [WHATSAPP_TABS.SETTINGS]: SlidersHorizontal,
};

interface WhatsAppTabsProps {
  access: WhatsAppAccess;
  stores: { id: string; name: string }[];
  businessName: string;
}

export function WhatsAppTabs({ access, stores, businessName }: WhatsAppTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = parseWhatsAppTab(searchParams.get("tab"));
  const [storedTab, setStoredTab] = useState<WhatsAppTab | null>(null);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);

  useEffect(() => {
    setStoredTab(readStoredWhatsAppTab());
    setPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (urlTab) writeStoredWhatsAppTab(urlTab);
  }, [urlTab]);

  const activeTab = resolveWhatsAppTab({ urlTab, storedTab });
  const ready = urlTab !== null || preferenceLoaded;

  const navigateTo = (search: string) => {
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const handleTabChange = (value: string) => {
    const tab = parseWhatsAppTab(value);
    if (!tab) return;
    setStoredTab(tab);
    writeStoredWhatsAppTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    if (tab !== WHATSAPP_TABS.SCHEDULING) {
      params.delete(RULE_LINK_PARAMS.rule);
      params.delete(RULE_LINK_PARAMS.template);
    }
    if (tab !== WHATSAPP_TABS.CONVERSATIONS) params.delete(CONVERSATION_THREAD_PARAM);
    navigateTo(params.toString());
  };

  if (!ready) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted p-1.5">
        {WHATSAPP_TAB_DEFINITIONS.map((tab) => {
          const Icon = TAB_ICONS[tab.key];
          return (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="flex-none gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm lg:flex-1"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {WHATSAPP_TAB_DEFINITIONS.map((tab) => (
        <TabsContent key={tab.key} value={tab.key} className="mt-4">
          <WhatsAppTabPanel
            definition={tab}
            access={access}
            stores={stores}
            businessName={businessName}
            search={searchParams.toString()}
            onNavigate={navigateTo}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
