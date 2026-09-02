import { z } from "zod";

export const applySchema = z.object({
  note: z.string().trim().max(2000, "Keep your note under 2000 characters").optional(),
  attachCv: z.boolean().default(true),
});

export type ApplyValues = z.infer<typeof applySchema>;
