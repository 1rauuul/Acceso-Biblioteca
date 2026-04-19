"use client";

import { Slider } from "@/components/ui/slider";

interface RatingSliderProps {
  label: string;
  emoji: string;
  value: number;
  onChange: (value: number) => void;
}

export function RatingSlider({
  label,
  emoji,
  value,
  onChange,
}: RatingSliderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {label}{" "}
          <span aria-hidden="true" className="ml-1">
            {emoji}
          </span>
        </label>
        <span
          className="min-w-[2ch] text-right text-lg font-bold text-primary"
          aria-live="polite"
          aria-label={`${label}: ${value} de 5`}
        >
          {value}
        </span>
      </div>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        aria-label={label}
        className="[&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-track]]:h-2"
      />
    </div>
  );
}
