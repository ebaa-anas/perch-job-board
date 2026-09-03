import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/** Read-only star row. `value` may be fractional (e.g. 4.3). */
export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 align-middle", className)}
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0 text-muted-foreground/40"
              style={{ width: size, height: size }}
            />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                className="fill-highlight text-highlight"
                style={{ width: size, height: size }}
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}
