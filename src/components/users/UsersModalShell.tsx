"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type UsersDialogSize = "sm" | "md" | "lg";

const SIZES: Record<UsersDialogSize, string> = {
  sm: "sm:max-w-lg",
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl lg:max-w-4xl",
};

export const usersDialogContentClass = (size: UsersDialogSize) =>
  cn("flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0", SIZES[size]);

interface UsersDialogHeaderProps {
  icon: string;
  iconClassName: string;
  title: string;
  subtitle: string;
}

export function UsersDialogHeader({ icon, iconClassName, title, subtitle }: UsersDialogHeaderProps) {
  return (
    <DialogHeader className="shrink-0 flex-row items-start gap-3 border-b px-5 py-4 pr-12 text-left sm:px-6 sm:text-left">
      <div
        aria-hidden="true"
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg", iconClassName)}
      >
        {icon}
      </div>
      <div className="min-w-0 space-y-1">
        <DialogTitle className="break-words text-base leading-snug">{title}</DialogTitle>
        <DialogDescription className="break-words text-xs">{subtitle}</DialogDescription>
      </div>
    </DialogHeader>
  );
}

export function UsersDialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-slot="users-dialog-body"
      className={cn("relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6", className)}
    >
      {children}
    </div>
  );
}

export function UsersDialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <DialogFooter className="shrink-0 border-t px-5 py-4 sm:px-6 [&>button]:w-full sm:[&>button]:w-auto">
      {children}
    </DialogFooter>
  );
}

interface UsersModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: string;
  iconClassName: string;
  title: string;
  subtitle: string;
  size?: UsersDialogSize;
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
  size = "sm",
  footer,
  children,
}: UsersModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={usersDialogContentClass(size)}>
        <UsersDialogHeader icon={icon} iconClassName={iconClassName} title={title} subtitle={subtitle} />
        <UsersDialogBody>{children}</UsersDialogBody>
        <UsersDialogFooter>{footer}</UsersDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
