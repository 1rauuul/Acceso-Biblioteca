"use client";

import { useState, useCallback } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

export function StarRating({ value, onChange, label }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onChange(Math.min(5, value + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onChange(Math.max(1, value - 1));
      }
    },
    [value, onChange]
  );

  const activeValue = hoverValue || value;

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={label ?? "Calificación con estrellas"}
        className="flex gap-1"
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHoverValue(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
            tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            className={cn(
              "rounded-md p-1 transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              star <= activeValue ? "scale-110" : "scale-100 hover:scale-110"
            )}
          >
            <Star
              className={cn(
                "size-10 transition-colors duration-150",
                star <= activeValue
                  ? "fill-gold stroke-gold"
                  : "fill-transparent stroke-muted-foreground/40"
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
