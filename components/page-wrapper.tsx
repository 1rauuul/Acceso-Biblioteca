import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <main
      className={cn(
        "flex min-h-dvh flex-col animate-fade-slide-up",
        className
      )}
    >
      {children}
    </main>
  );
}
