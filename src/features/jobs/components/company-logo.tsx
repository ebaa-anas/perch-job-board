import Image from "next/image";

import { cn } from "@/lib/utils";
import { getInitials } from "@/features/jobs/utils";
import { logoPublicUrl } from "@/features/companies/logo-url";

const SIZES = {
  sm: { cls: "size-9 rounded-lg text-[0.7rem]", px: 36 },
  md: { cls: "size-11 rounded-lg text-sm", px: 44 },
  lg: { cls: "size-14 rounded-xl text-base", px: 56 },
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
  const { cls, px } = SIZES[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={`${company} logo`}
        width={px}
        height={px}
        sizes={`${px}px`}
        className={cn(
          "shrink-0 bg-card object-contain ring-1 ring-inset ring-black/5 dark:ring-white/10",
          cls,
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
        cls,
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
    >
      {getInitials(company)}
    </span>
  );
}
