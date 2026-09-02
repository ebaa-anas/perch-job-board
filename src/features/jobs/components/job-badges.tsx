import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  EXPERIENCE_LABELS,
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
  type ExperienceLevel,
  type JobType,
  type WorkMode,
} from "@/features/jobs/types";

const TYPE_TONES: Record<JobType, BadgeTone> = {
  "full-time": "primary",
  "part-time": "info",
  contract: "warning",
  internship: "success",
};

const MODE_TONES: Record<WorkMode, BadgeTone> = {
  remote: "success",
  hybrid: "info",
  "on-site": "neutral",
};

export function JobTypeBadge({ type }: { type: JobType }) {
  return <Badge tone={TYPE_TONES[type]}>{JOB_TYPE_LABELS[type]}</Badge>;
}

export function WorkModeBadge({ mode }: { mode: WorkMode }) {
  return <Badge tone={MODE_TONES[mode]}>{WORK_MODE_LABELS[mode]}</Badge>;
}

export function ExperienceBadge({ level }: { level: ExperienceLevel }) {
  return <Badge tone="outline">{EXPERIENCE_LABELS[level]}</Badge>;
}
