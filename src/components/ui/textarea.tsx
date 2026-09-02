import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      "flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/25",
      "resize-y min-h-20",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
