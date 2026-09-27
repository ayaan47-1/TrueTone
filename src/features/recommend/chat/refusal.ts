// Input-side hard refuse (CLAUDE.md §1): any mole/lesion/cancer/melanoma assessment short-circuits
// to a dermatologist referral BEFORE the LLM is called. Defense-in-depth with the output post-filter.
import { ALLERGEN_DISCLAIMER } from '../../../content/medical-claims';

const MEDICAL_TRIGGERS = [
  'mole', 'lesion', 'cancer', 'melanoma', 'carcinoma', 'tumor', 'tumour',
  'biopsy', 'diagnos', 'is this normal', 'should i be worried',
  'precancerous', 'pre-cancer', 'dysplasia', 'cyst', 'dermoscopy', 'dermatoscopy', 'does this look normal',
];

// Founder hard rule: never give medical or allergy advice (compliance.md §3.2.2). Allergy, reaction,
// safety and medication questions short-circuit to a check-the-label + see-a-clinician referral.
const ALLERGY_TRIGGERS = [
  'allerg', 'safe for me', 'safe for my', 'is this safe', 'is it safe', 'will i react',
  'react to', 'reaction', 'patch test', 'patch-test', 'sensitive to', 'rash', 'hives', 'swelling',
  'anaphyla', 'epipen', 'medication', 'medicine', 'prescription', 'antibiotic', 'steroid',
  'dosage', 'dose',
];

export function isMedicalQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return MEDICAL_TRIGGERS.some((t) => lower.includes(t));
}

export function isAllergyQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return ALLERGY_TRIGGERS.some((t) => lower.includes(t));
}

export const REFERRAL_MESSAGE =
  "I can only describe how skin looks — I can't assess moles, spots, or anything medical. " +
  'If you have a concern about a specific spot or change in your skin, please see a board-certified ' +
  'dermatologist, who can examine it properly.';

// Design C10 + the canonical disclaimer (C2), injected rather than left to the model.
export const ALLERGY_REFUSAL =
  "I can't give advice about allergies. I can show which of your flagged ingredients a product " +
  'lists. Check the current label, and talk to a doctor or dermatologist about allergy questions.' +
  '\n\n' + ALLERGEN_DISCLAIMER;
