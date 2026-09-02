"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Is Perch free?",
    a: "Yes. Browsing and applying are free for job seekers, and posting a role is free for recruiters while we grow.",
  },
  {
    q: "Do I need an account to browse?",
    a: "No. Search, filter and save jobs without signing in — saved roles live on your device and sync to your account if you sign up later.",
  },
  {
    q: "How do applications work?",
    a: "Most roles are applied to on Perch: add a short note, attach your CV, and the recruiter sees your profile and gets an email. Some roles link out to the company's own site instead.",
  },
  {
    q: "Can I be both a seeker and a recruiter?",
    a: "Each account is one or the other, chosen at sign-up. Use a separate email if you need both.",
  },
  {
    q: "Where does my data live?",
    a: "In a Postgres database with row-level security, so people only ever read and write what they're allowed to. Your CV is private and shared only with recruiters you apply to.",
  },
];

export function Faq() {
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span className="font-medium">{item.q}</span>
              <Plus
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-45",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-all duration-200",
                isOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
