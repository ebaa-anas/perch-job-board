import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const CATEGORIES: { label: string; query: string }[] = [
  { label: "Engineering", query: "engineer" },
  { label: "Design", query: "design" },
  { label: "Product", query: "product" },
  { label: "Data", query: "data" },
  { label: "Remote", query: "remote" },
  { label: "Marketing", query: "marketing" },
  { label: "Frontend", query: "frontend" },
  { label: "Senior", query: "senior" },
];

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CATEGORIES.map((c) => (
        <Link
          key={c.label}
          href={`/jobs?q=${encodeURIComponent(c.query)}`}
          className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-medium shadow-sm transition-colors hover:border-primary hover:bg-accent"
        >
          {c.label}
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      ))}
    </div>
  );
}
