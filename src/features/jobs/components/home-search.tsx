"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = ["React", "Design", "Remote", "Senior", "Internship"];

export function HomeSearch() {
  const router = useRouter();
  const [value, setValue] = React.useState("");

  const go = (query: string) => {
    const trimmed = query.trim();
    router.push(trimmed ? `/jobs?q=${encodeURIComponent(trimmed)}` : "/jobs");
  };

  return (
    <div className="w-full max-w-xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card/90 p-2 shadow-lg backdrop-blur sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Job title, company, or skill"
            aria-label="Search jobs"
            className="h-12 border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 shrink-0">
          Search jobs
          <ArrowRight className="size-4" />
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Popular:</span>
        {SUGGESTIONS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => go(term)}
            className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}
