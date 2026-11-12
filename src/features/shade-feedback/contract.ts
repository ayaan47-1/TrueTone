import { z } from 'zod';
export { SERVER_FEEDBACK_ENABLED } from './flags';

const gid = z.string().regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/).max(100);
const version = z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/);
const depth = z.enum(['as_expected','too_light','too_dark','not_sure']);
const undertone = z.enum(['as_expected','too_warm','too_cool','not_sure']);
const outcome = z.enum(['kept','returned_color','returned_other','still_deciding']).nullable();
export const correctionSchema = z.strictObject({depth_correction:depth,undertone_correction:undertone,outcome})
  .refine(value => value.depth_correction !== 'not_sure' || value.undertone_correction !== 'not_sure');
export const candidateSchema = z.strictObject({
  position:z.number().int().min(1).max(3),variant_gid:gid,label_id:z.uuid(),
  label_revision:z.number().int().positive(),formula_version:version,available_at_display:z.boolean(),
});
export const feedbackSchema = z.strictObject({
  consent_receipt_id:z.uuid(),recommendation_id:z.uuidv4(),engine_version:version,catalog_as_of:z.iso.datetime(),
  estimated_variant_gid:gid,estimated_label_id:z.uuid(),estimated_label_revision:z.number().int().positive(),
  estimated_formula_version:version,tried_variant_gid:gid,depth_correction:depth,undertone_correction:undertone,outcome,
  displayed_at:z.iso.datetime(),candidates:z.array(candidateSchema).min(1).max(3),
}).refine(value => {
  const positions = value.candidates.map(candidate => candidate.position);
  return (value.depth_correction !== 'not_sure' || value.undertone_correction !== 'not_sure') &&
    (value.tried_variant_gid === value.estimated_variant_gid || value.candidates.some(candidate => candidate.variant_gid === value.tried_variant_gid)) &&
    positions.every((position,index) => position === index+1) &&
    new Set(value.candidates.map(candidate => candidate.variant_gid)).size === value.candidates.length;
});
export type FeedbackPayload = z.infer<typeof feedbackSchema>;
export type Correction = z.infer<typeof correctionSchema>;
export const parseCorrection = (value:unknown):Correction => correctionSchema.parse(value);
export function parseFeedback(value:unknown):FeedbackPayload {
  const result = feedbackSchema.parse(value);
  if (JSON.stringify(result).length > 4096) throw new Error('Answer is too large');
  return result;
}
export const localAnswerSchema = z.strictObject({variant_gid:gid,depth_correction:depth,undertone_correction:undertone,outcome})
  .refine(value => value.depth_correction !== 'not_sure' || value.undertone_correction !== 'not_sure');

export const feedbackPageSchema=z.strictObject({
  events:z.array(z.strictObject({...feedbackSchema.shape,
    id:z.uuid(),user_id:z.uuid(),submitted_at:z.iso.datetime({offset:true}),outcome_at:z.iso.datetime({offset:true}).nullable(),
    expires_at:z.iso.datetime({offset:true}),purpose_closed_at:z.iso.datetime({offset:true}).nullable(),
    catalog_as_of:z.iso.datetime({offset:true}),displayed_at:z.iso.datetime({offset:true}),
  }).omit({candidates:true})).max(50),
  candidates:z.array(candidateSchema.extend({feedback_id:z.uuid(),user_id:z.uuid()})).max(150),
});
