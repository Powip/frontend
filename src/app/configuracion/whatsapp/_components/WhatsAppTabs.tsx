"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WHATSAPP_TABS, type WhatsAppTab } from "@/features/whatsapp/enums/whatsapp.enums";
import { RULE_LINK_PARAMS } from "@/features/whatsapp/utils/rule-link.util";
import type { WhatsAppAccess } from "@/features/whatsapp/utils/whatsapp-access.util";
import {
  parseWhatsAppTab,
  readStoredWhatsAppTab,
  resolveWhatsAppTab,
  type WhatsAppNavigate,
  writeStoredWhatsAppTab,
} from "@/features/whatsapp/utils/whatsapp-tab.util";
import { CONVERSATION_THREAD_PARAM } from "./conversaciones/ConversationsTab";
import { WhatsAppTabsShell } from "./WhatsAppPageLayout";
import { WhatsAppTabPanel } from "./WhatsAppTabPanel";

interface WhatsAppTabsProps {
  access: WhatsAppAccess;
  businessName: string;
}

export function WhatsAppTabs({ access, businessName }: WhatsAppTabsProps) {
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

  const navigateTo: WhatsAppNavigate = (search, options) => {
    const href = search ? `${pathname}?${search}` : pathname;
    if (options?.replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
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
      <div aria-busy="true" className="space-y-[22px]">
        <Skeleton className="h-11 w-full max-w-[860px] rounded-xl bg-wa-surface-2" />
        <Skeleton className="h-40 w-full rounded-2xl bg-wa-surface-2" />
      </div>
    );
  }

  return (
    <WhatsAppTabsShell
      value={activeTab}
      onValueChange={handleTabChange}
      renderPanel={(definition) => (
        <WhatsAppTabPanel
          definition={definition}
          access={access}
          businessName={businessName}
          search={searchParams.toString()}
          onNavigate={navigateTo}
        />
      )}
    />
  );
}
