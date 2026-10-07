"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UsersModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: string;
  iconClassName: string;
  title: string;
  subtitle: string;
  size?: "md" | "lg";
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function UsersModalShell({
  open,
  onOpenChange,
  icon,
  iconClassName,
  title,
  subtitle,
  size = "md",
  footer,
  children,
}: UsersModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`!w-full !max-w-[calc(100vw-2rem)] max-h-[90vh] gap-0 overflow-y-auto rounded-2xl p-0 ${
          size === "lg" ? "md:!max-w-[820px]" : "sm:!max-w-[580px]"
        }`}
      >
        <DialogHeader className="sticky top-0 z-10 flex-row items-start gap-2.5 space-y-0 border-b border-[#e8e4f8] bg-background px-[22px] pb-3.5 pt-[18px] text-left dark:border-border">
          <div
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-lg ${iconClassName}`}
          >
            {icon}
          </div>
          <div className="pr-6">
            <DialogTitle className="text-[15px] font-extrabold text-[#0e0b1f] dark:text-foreground">{title}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-[#8b87a3]">{subtitle}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="px-[22px] pb-5 pt-[18px]">{children}</div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#e8e4f8] bg-background px-[22px] py-3.5 dark:border-border">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}
