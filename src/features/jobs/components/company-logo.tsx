import { cn } from "@/lib/utils";
import { getInitials } from "@/features/jobs/utils";
import { logoPublicUrl } from "@/features/companies/logo-url";

const SIZES = {
  sm: "size-9 rounded-lg text-[0.7rem]",
  md: "size-11 rounded-lg text-sm",
  lg: "size-14 rounded-xl text-base",
} as const;

export function CompanyLogo({
  company,
  color,
  logoPath,
  size = "md",
  className,
}: {
  company: string;
  color: string;
  logoPath?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = logoPublicUrl(logoPath);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-supplied host, no loader config
      <img
        src={src}
        alt={`${company} logo`}
        className={cn(
          "shrink-0 object-contain ring-1 ring-inset ring-black/5 dark:ring-white/10",
          SIZES[size],
          className,
        )}
      />
    );
  }

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
