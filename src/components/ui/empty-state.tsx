import React from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50",
        className
      )}
    >
      {Icon && (
        <div className="p-3 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4">
          <Icon className="h-8 w-8 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs mx-auto">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="outline"
          className="mt-6 gap-2 bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700"
        >
          <RefreshCw className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
