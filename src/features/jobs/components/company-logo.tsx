import { cn } from "@/lib/utils";
import { getInitials } from "@/features/jobs/utils";

const SIZES = {
  sm: "size-9 rounded-lg text-[0.7rem]",
  md: "size-11 rounded-lg text-sm",
  lg: "size-14 rounded-xl text-base",
} as const;

export function CompanyLogo({
  company,
  color,
  size = "md",
  className,
}: {
  company: string;
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {getInitials(company)}
    </span>
  );
}
