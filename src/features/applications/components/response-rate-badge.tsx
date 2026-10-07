import { MessageSquareReply } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * How often this employer answers the people who apply to it.
 *
 * Public on purpose. A seeker's scarcest resource is the time spent applying
 * into silence, and an employer's incentive to use the pipeline at all is that
 * not using it is visible here. The wording stays factual rather than
 * judgemental — the number does the work.
 */
export function ResponseRateBadge({
  rate,
  total,
}: {
  /** 0–100. */
  rate: number;
  /** Applications the rate is computed over, for context. */
  total: number;
}) {
  // Below half, the honest framing is the gap, not the achievement.
  const tone = rate >= 80 ? "success" : rate >= 50 ? "info" : "warning";

  return (
    <Badge tone={tone} title={`Based on ${total} application${total === 1 ? "" : "s"}`}>
      <MessageSquareReply className="size-3" aria-hidden />
      Replies to {rate}% of applicants
    </Badge>
  );
}
