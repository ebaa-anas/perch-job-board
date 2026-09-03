import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/features/auth/session";

export interface CompanyReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  reviewerName: string | null;
  status: "visible" | "hidden";
  isOwn: boolean;
}

export interface ReviewSummary {
  avg: number | null;
  count: number;
}

/** Aggregate rating for a company (visible reviews only). */
export const getReviewSummary = cache(
  async (companyId: string): Promise<ReviewSummary> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_reviews")
      .select("rating")
      .eq("company_id", companyId)
      .eq("status", "visible");
    const ratings = (data ?? []).map((r) => r.rating as number);
    if (ratings.length === 0) return { avg: null, count: 0 };
    const avg = ratings.reduce((s, n) => s + n, 0) / ratings.length;
    return { avg: Math.round(avg * 10) / 10, count: ratings.length };
  },
);

/** Public reviews for a company + the caller's own review flagged. */
export const getCompanyReviews = cache(
  async (companyId: string): Promise<CompanyReview[]> => {
    const [supabase, user] = await Promise.all([createClient(), getUser()]);
    const { data } = await supabase
      .from("company_reviews")
      .select(
        "id, rating, title, body, status, created_at, reviewer_id, profiles ( full_name )",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    type Row = {
      id: string;
      rating: number;
      title: string | null;
      body: string | null;
      status: "visible" | "hidden";
      created_at: string;
      reviewer_id: string;
      profiles: { full_name: string | null } | null;
    };

    return (data as unknown as Row[] | null ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      createdAt: r.created_at,
      reviewerName: r.profiles?.full_name ?? null,
      isOwn: Boolean(user) && r.reviewer_id === user!.id,
    }));
  },
);

/** The signed-in seeker's own review of this company, if any. */
export const getOwnReview = cache(
  async (
    companyId: string,
  ): Promise<{ rating: number; title: string; body: string } | null> => {
    const user = await getUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("company_reviews")
      .select("rating, title, body")
      .eq("company_id", companyId)
      .eq("reviewer_id", user.id)
      .maybeSingle();
    return data
      ? { rating: data.rating, title: data.title ?? "", body: data.body ?? "" }
      : null;
  },
);
