// Skin-feel diary moods. These describe how the user's skin FEELS to them today —
// a subjective wellness check-in, not a clinical assessment. No disease terms.

export const MOODS = [
  { value: 'bad', label: 'Bad' },
  { value: 'not_great', label: 'Not great' },
  { value: 'okay', label: 'Okay' },
  { value: 'good', label: 'Good' },
  { value: 'awesome', label: 'Awesome' },
] as const;

export type MoodValue = (typeof MOODS)[number]['value'];

export function isMoodValue(v: unknown): v is MoodValue {
  return typeof v === 'string' && MOODS.some((m) => m.value === v);
}
