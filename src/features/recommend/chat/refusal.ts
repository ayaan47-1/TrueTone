// Input-side hard refuse (CLAUDE.md §1): any mole/lesion/cancer/melanoma assessment short-circuits
// to a dermatologist referral BEFORE the LLM is called. Defense-in-depth with the output post-filter.
const MEDICAL_TRIGGERS = [
  'mole', 'lesion', 'cancer', 'melanoma', 'carcinoma', 'tumor', 'tumour',
  'biopsy', 'diagnos', 'is this normal', 'should i be worried',
  'precancerous', 'pre-cancer', 'dysplasia', 'cyst', 'dermoscopy', 'dermatoscopy', 'does this look normal',
];

export function isMedicalQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return MEDICAL_TRIGGERS.some((t) => lower.includes(t));
}

export const REFERRAL_MESSAGE =
  "I can only describe how skin looks — I can't assess moles, spots, or anything medical. " +
  'If you have a concern about a specific spot or change in your skin, please see a board-certified ' +
  'dermatologist, who can examine it properly.';
