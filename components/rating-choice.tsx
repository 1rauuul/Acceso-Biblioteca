"use client";

import { cn } from "@/lib/utils";

interface RatingChoiceProps {
  name: string;
  label: string;
  value: number; // 0 = nothing selected yet
  onChange: (value: number) => void;
}

export function RatingChoice({
  name,
  label,
  value,
  onChange,
}: RatingChoiceProps) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 text-base font-medium text-foreground">
        {label}
      </legend>
      <div className="flex items-center justify-between px-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const checked = value === n;
          return (
            <label
              key={n}
              className="group flex cursor-pointer flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "text-base tabular-nums transition-colors",
                  checked
                    ? "font-bold text-primary"
                    : "text-muted-foreground"
                )}
              >
                {n}
              </span>
              <input
                type="radio"
                name={name}
                value={n}
                checked={checked}
                onChange={() => onChange(n)}
                className="sr-only"
                aria-label={`${label}: ${n} de 5`}
              />
              <span
                aria-hidden="true"
                className={cn(
                  "size-7 rounded-full border-2 transition-all duration-150",
                  "group-focus-within:ring-2 group-focus-within:ring-primary/50",
                  checked
                    ? "border-primary bg-primary ring-2 ring-primary/25"
                    : "border-muted-foreground/40 group-hover:border-primary/60 group-hover:bg-primary/5"
                )}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
