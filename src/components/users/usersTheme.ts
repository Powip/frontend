export const usersTheme = {
  primaryButton:
    "inline-flex items-center gap-1.5 rounded-[9px] bg-[#4C2FB5] px-[18px] py-[9px] text-[13px] font-semibold text-white transition-colors hover:bg-[#3a22a0] disabled:cursor-not-allowed disabled:opacity-60",
  secondaryButton:
    "inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] border-[#e8e4f8] bg-white px-4 py-2 text-[13px] font-semibold text-[#2D2A45] transition-colors hover:border-[#4C2FB5] hover:text-[#4C2FB5] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-transparent dark:text-foreground",
  card: "rounded-[12px] border border-[#e8e4f8] bg-white dark:border-border dark:bg-card",
  muted: "text-[#8b87a3]",
  ink: "text-[#0e0b1f] dark:text-foreground",
  sectionTitle: "text-xs font-bold uppercase tracking-[0.06em] text-[#8b87a3]",
  fieldLabel: "text-[11px] font-bold uppercase tracking-[0.05em] text-[#2D2A45] dark:text-foreground",
  requiredMark: "after:ml-0.5 after:text-[#dc2626] after:content-['*']",
  input:
    "rounded-[9px] border-[1.5px] border-[#e8e4f8] text-[13px] focus-visible:border-[#4C2FB5] focus-visible:ring-[3px] focus-visible:ring-[#4C2FB5]/15",
  selectableCard:
    "relative rounded-[9px] border-2 border-[#e8e4f8] bg-white p-3 text-center transition-colors hover:border-[#4C2FB5] has-[:checked]:border-[#4C2FB5] has-[:checked]:bg-[#f0eeff] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4C2FB5]/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 dark:bg-transparent",
} as const;

const ROLE_STYLES: Array<{ match: RegExp; icon: string; pill: string; tile: string }> = [
  { match: /^(ADMIN|ADMINISTRADOR|OWNER|SUPERADMIN)$/, icon: "👑", pill: "bg-[#ede9fe] text-[#5b21b6]", tile: "bg-[#ede9fe]" },
  { match: /VENTA/, icon: "💬", pill: "bg-[#e6f7f7] text-[#027778]", tile: "bg-[#e6f7f7]" },
  { match: /OPERACION|COURIER/, icon: "🚛", pill: "bg-[#fff7ed] text-[#c2410c]", tile: "bg-[#fff7ed]" },
  { match: /MARKETING/, icon: "📣", pill: "bg-[#fce7f3] text-[#be185d]", tile: "bg-[#fce7f3]" },
  { match: /CALLER|AGENTE|CONTACT|ATENCION/, icon: "🎧", pill: "bg-[#dbeafe] text-[#1e40af]", tile: "bg-[#dbeafe]" },
  { match: /LECTURA|USUARIO/, icon: "👁️", pill: "bg-[#f3f4f6] text-[#6b7280]", tile: "bg-[#f3f4f6]" },
];

const DEFAULT_ROLE_STYLE = { icon: "🔑", pill: "bg-[#f0eeff] text-[#4C2FB5]", tile: "bg-[#f0eeff]" };

export const roleStyle = (name?: string | null) => {
  const normalized = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
  return ROLE_STYLES.find((style) => style.match.test(normalized)) ?? DEFAULT_ROLE_STYLE;
};
