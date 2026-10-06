"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles, TriangleAlert } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getFitScore, type FitScoreResult } from "@/features/matching/actions";

function scoreTone(score: number): { ring: string; text: string } {
  if (score >= 75) return { ring: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 50) return { ring: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { ring: "stroke-muted-foreground", text: "text-muted-foreground" };
}

function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} strokeWidth="6" className="fill-none stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("fill-none transition-[stroke-dashoffset] duration-500", tone.ring)}
        />
      </svg>
      <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-semibold", tone.text)}>
        {score}%
      </span>
    </div>
  );
}

export function FitScoreCard({ jobId }: { jobId: string }) {
  const [result, setResult] = React.useState<FitScoreResult | "loading">("loading");

  React.useEffect(() => {
    let active = true;
    getFitScore(jobId).then((r) => {
      if (active) setResult(r);
    });
    return () => {
      active = false;
    };
  }, [jobId]);

  if (result === "loading") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!result.ok) {
    if (result.reason === "signed-out" || result.reason === "not-found") return null;

    if (result.reason === "no-profile") {
      return (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm shadow-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <Sparkles className="size-4 text-primary" />
            See your AI match score
          </p>
          <p className="mt-1.5 text-muted-foreground">
            Add a headline, a few skills, or a short bio to your profile and
            we&apos;ll show how well you fit this role.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-block font-medium text-primary hover:underline"
          >
            Complete your profile →
          </Link>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
        <p className="flex items-center gap-1.5">
          <TriangleAlert className="size-4" />
          {result.reason === "rate-limited"
            ? "You've used up today's match scores. They reset tomorrow."
            : "Match scoring is temporarily unavailable."}
        </p>
      </div>
    );
  }

  const { score, summary, strengths, gaps } = result.data;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="size-4 text-primary" />
        Your AI match
      </p>
      <div className="mt-4 flex items-center gap-4">
        <ScoreRing score={score} />
        <p className="text-sm leading-relaxed">{summary}</p>
      </div>
      {strengths.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {strengths.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {gaps.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {gaps.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
