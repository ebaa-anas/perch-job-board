"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  JOB_TYPES,
  JOB_TYPE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  type ExperienceLevel,
  type JobFilters as JobFiltersValue,
  type JobType,
  type SortOption,
  type WorkMode,
} from "@/features/jobs/types";
import { countActiveFilters, filtersToSearchParams } from "@/features/jobs/utils";

const MIN_SALARY_OPTIONS = [
  { value: 0, label: "Any salary" },
  { value: 40000, label: "$40k+" },
  { value: 70000, label: "$70k+" },
  { value: 100000, label: "$100k+" },
  { value: 130000, label: "$130k+" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Best match" },
  { value: "recent", label: "Newest" },
  { value: "salary", label: "Highest salary" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function JobFilters({
  filters,
  resultCount,
}: {
  filters: JobFiltersValue;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState(filters.q ?? "");
  const [open, setOpen] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the search box in sync when `filters.q` changes from the outside
  // (browser back/forward, "Clear filters"). This is the React-sanctioned
  // "adjust state while rendering" pattern rather than an effect.
  const [lastExternalQuery, setLastExternalQuery] = React.useState(filters.q);
  if (filters.q !== lastExternalQuery) {
    setLastExternalQuery(filters.q);
    setQuery(filters.q ?? "");
  }

  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const commit = React.useCallback(
    (next: JobFiltersValue) => {
      const qs = filtersToSearchParams(next).toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router],
  );

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commit({ ...filters, q: value.trim() || undefined });
    }, 350);
  };

  function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
    const set = new Set(list ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    const next = Array.from(set);
    return next.length ? next : undefined;
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search title, company, or skill…"
            className="pl-9"
            aria-label="Search jobs"
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-muted lg:hidden",
            activeCount > 0 && "border-primary/40 text-primary",
          )}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <div className={cn("mt-4 space-y-4", open ? "block" : "hidden lg:block")}>
        <ChipGroup label="Job type">
          {JOB_TYPES.map((type) => (
            <Chip
              key={type}
              active={filters.type?.includes(type) ?? false}
              onClick={() =>
                commit({ ...filters, type: toggle<JobType>(filters.type, type) })
              }
            >
              {JOB_TYPE_LABELS[type]}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Work mode">
          {WORK_MODES.map((mode) => (
            <Chip
              key={mode}
              active={filters.mode?.includes(mode) ?? false}
              onClick={() =>
                commit({ ...filters, mode: toggle<WorkMode>(filters.mode, mode) })
              }
            >
              {WORK_MODE_LABELS[mode]}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Experience">
          {EXPERIENCE_LEVELS.map((level) => (
            <Chip
              key={level}
              active={filters.level?.includes(level) ?? false}
              onClick={() =>
                commit({
                  ...filters,
                  level: toggle<ExperienceLevel>(filters.level, level),
                })
              }
            >
              {EXPERIENCE_LABELS[level]}
            </Chip>
          ))}
        </ChipGroup>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Minimum salary
            </span>
            <Select
              value={filters.minSalary ?? 0}
              onChange={(event) =>
                commit({
                  ...filters,
                  minSalary: Number(event.target.value) || undefined,
                })
              }
            >
              {MIN_SALARY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Sort by
            </span>
            <Select
              value={filters.sort ?? "relevance"}
              onChange={(event) =>
                commit({ ...filters, sort: event.target.value as SortOption })
              }
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">
          {resultCount} {resultCount === 1 ? "job" : "jobs"}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => commit({ sort: filters.sort })}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
