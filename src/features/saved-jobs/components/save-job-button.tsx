"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSavedJobs } from "@/features/saved-jobs/saved-jobs-provider";

interface SaveJobButtonProps {
  jobId: string;
  /** `icon` = square toggle, `full` = labelled button. */
  layout?: "icon" | "full";
  /** Smaller icon button, for use on cards. */
  compact?: boolean;
  className?: string;
}

export function SaveJobButton({
  jobId,
  layout = "icon",
  compact = false,
  className,
}: SaveJobButtonProps) {
  const { isSaved, toggle, hydrated, canSave } = useSavedJobs();
  const saved = hydrated && isSaved(jobId);
  const Icon = saved ? BookmarkCheck : Bookmark;

  // Recruiters / admins don't get a save control.
  if (!canSave) return null;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(jobId);
  };

  if (layout === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved jobs" : "Save this job"}
        title={saved ? "Remove from saved jobs" : "Save this job"}
        className={cn(
          "inline-flex items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "size-8" : "size-10",
          saved
            ? "border-primary/30 bg-accent text-primary"
            : "border-input bg-card/80 text-muted-foreground backdrop-blur hover:bg-muted hover:text-foreground",
          className,
        )}
      >
        <Icon className={cn(compact ? "size-4" : "size-[1.15rem]", saved && "fill-current")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      className={buttonVariants({
        variant: saved ? "secondary" : "outline",
        className: cn(saved && "text-primary", className),
      })}
    >
      <Icon className={cn(saved && "fill-current")} />
      {saved ? "Saved" : "Save job"}
    </button>
  );
}
