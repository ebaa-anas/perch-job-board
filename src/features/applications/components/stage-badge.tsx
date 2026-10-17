import { Badge } from "@/components/ui/badge";
import {
  SEEKER_STATUS_LABELS,
  SEEKER_STATUS_TONES,
  STAGE_LABELS,
  STAGE_TONES,
  type ApplicationStage,
  type SeekerStatus,
} from "@/features/applications/pipeline";

/**
 * Two badges, deliberately separate.
 *
 * `StageBadge` shows the recruiter's internal stage and must never render on a
 * candidate-facing surface; `StatusBadge` shows the coarser status the
 * candidate is told. Keeping them as distinct components means the wrong one
 * cannot be reached for by accident.
 */

export function StageBadge({ stage }: { stage: ApplicationStage }) {
  return <Badge tone={STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

export function StatusBadge({ status }: { status: SeekerStatus }) {
  return (
    <Badge tone={SEEKER_STATUS_TONES[status]}>{SEEKER_STATUS_LABELS[status]}</Badge>
  );
}
