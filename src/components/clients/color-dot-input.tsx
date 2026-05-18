"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ColorDotInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ColorDotInput({ id, label, value, onChange }: ColorDotInputProps) {
  return (
    <div className="inline-flex">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <label
        htmlFor={id}
        className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-border bg-background"
        title={label}
      >
        <span
          className="h-8 w-8 rounded-full border border-black/10"
          style={{ backgroundColor: value }}
        />
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </label>
    </div>
  );
}
