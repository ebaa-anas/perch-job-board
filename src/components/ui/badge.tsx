import * as React from "react";

import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "info"
  | "outline";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-accent text-accent-foreground",
  success:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/15",
  warning:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15",
  info: "bg-sky-500/12 text-sky-700 dark:text-sky-300 dark:bg-sky-500/15",
  outline: "border border-border text-muted-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
