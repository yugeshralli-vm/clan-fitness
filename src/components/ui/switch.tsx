import type { InputHTMLAttributes } from "react";

export function Switch({
  label,
  className = "",
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input id={id} type="checkbox" className={`peer sr-only ${className}`} {...props} />
        <span className="h-6 w-11 rounded-full bg-surface-border transition-colors peer-checked:bg-accent" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
