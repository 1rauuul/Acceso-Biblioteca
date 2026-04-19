"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MassiveButtonProps {
  variant: "success" | "danger";
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const variantStyles = {
  success:
    "bg-success hover:bg-success/90 text-success-foreground shadow-success/25 focus-visible:ring-success/50",
  danger:
    "bg-danger hover:bg-danger/90 text-danger-foreground shadow-danger/25 focus-visible:ring-danger/50",
};

export function MassiveButton({
  variant,
  icon,
  title,
  subtitle,
  onClick,
  loading = false,
  disabled = false,
  className,
}: MassiveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={title}
      aria-busy={loading}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center gap-3 rounded-3xl p-8 shadow-2xl transition-all duration-300 md:p-10",
        "active:scale-95 focus-visible:ring-4 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-60",
        variantStyles[variant],
        className
      )}
    >
      {loading ? (
        <Loader2 className="size-20 animate-spin" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{icon}</span>
      )}
      <span className="text-center text-3xl font-bold leading-tight">
        {title}
      </span>
      {subtitle && (
        <span className="text-center text-base opacity-80">{subtitle}</span>
      )}
    </button>
  );
}
