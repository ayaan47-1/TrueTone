// eval/fairness/manifest.ts
import { z } from 'zod';

// Every entry must carry an FST label and a consentRef; consentRef points at the
// consent/license record (BIPA/PIPA) — its presence is enforced here, its validity is a legal gate.
export const ManifestEntrySchema = z.object({
  imageRef: z.string().min(1),
  fst: z.enum(['I', 'II', 'III', 'IV', 'V', 'VI']),
  subjectId: z.string().min(1),
  lighting: z.string().min(1),
  source: z.string().min(1),
  consentRef: z.string().min(1),
  fstProvenance: z.enum(['self-report', 'annotated', 'estimated']),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export function parseManifest(raw: unknown): ManifestEntry[] {
  return z.array(ManifestEntrySchema).parse(raw);
}
