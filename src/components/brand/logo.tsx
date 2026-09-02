import { cn } from "@/lib/utils";

/**
 * Perch mark — a bird perched on a branch inside a rounded square. Colours are
 * driven by theme tokens so it inverts correctly in dark mode. Server-safe (no
 * "use client"). For the favicon see `src/app/icon.svg` (static hex, no tokens).
 */
export function Logo({
  size = 28,
  className,
  title = "Perch",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <rect width="96" height="96" rx="22" fill="var(--color-primary)" />
      <g transform="translate(6 16)">
        <path
          fill="var(--color-primary-foreground)"
          d="M0,58 C0,32 18,10 46,10 C62,10 74,20 74,34 C74,42 68,46 60,46 L10,46 C4,50 0,54 0,58 Z"
        />
        <path
          fill="var(--color-primary-foreground)"
          d="M74,26 L88,30 L74,34 Z"
        />
        <circle cx="52" cy="21" r="3.4" fill="var(--color-primary)" />
      </g>
    </svg>
  );
}

/** Logo + serif "Perch" lockup for headers and the auth screens. */
export function Wordmark({
  className,
  size = 26,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo size={size} />
      <span className="font-display text-[1.15rem] leading-none tracking-tight">
        Perch
      </span>
    </span>
  );
}
