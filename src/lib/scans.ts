import { supabase } from './supabase';
import { DIMENSIONS, SCORE_COLUMNS } from '../content/cosmetic-vocab';
import type { ReadResult, ScoreVector } from '../features/read/read-types';
import { buildRoutine } from '../features/recommend/routine-engine';
import { skincareDomain } from '../features/recommend/skincare/domain';
import type { Routine } from '../features/recommend/routine-types';
import type { SkinAgeEstimate } from '../features/age/age-types';
import { type RoutineHelpful, isRoutineHelpful } from '../features/feedback/types';

export interface Scan {
  id: string;
  capturedAt: string;
  skinType: string;
  scores: ScoreVector;
  modelVersion: string;
  isStub: boolean;
  routine: Routine;
  skinAge: number | null;
  skinAgeConfidence: number | null;
  routineHelpful: RoutineHelpful | null;
}

export async function recordScan(r: ReadResult, age: SkinAgeEstimate | null = null): Promise<void> {
  const routine = buildRoutine(skincareDomain, { scores: r.scores, skinType: r.skinType });
  const { error } = await supabase.rpc('record_scan', {
    p_scores: r.scores,
    p_skin_type: r.skinType,
    p_model_version: r.modelVersion,
    p_is_stub: r.isStub,
    p_routine: routine,
    p_routine_version: routine.version,
    p_skin_age: age?.ageEstimate ?? null,
    p_skin_age_confidence: age?.confidence ?? null,
  });
  if (error) throw new Error('record-scan-failed');
}

function rowToScan(row: Record<string, unknown>): Scan {
  const scores = Object.fromEntries(
    DIMENSIONS.map((d) => [d, Number(row[SCORE_COLUMNS[d]])]),
  ) as ScoreVector;
  const routine = (row.routine ?? { version: '', am: [], pm: [], notes: [] }) as Routine;
  return {
    id: String(row.id),
    capturedAt: String(row.captured_at),
    skinType: String(row.skin_type_feel),
    scores,
    modelVersion: String(row.model_version),
    isStub: Boolean(row.is_stub),
    routine,
    skinAge: row.skin_age_estimate == null ? null : Number(row.skin_age_estimate),
    skinAgeConfidence: row.skin_age_confidence == null ? null : Number(row.skin_age_confidence),
    routineHelpful: isRoutineHelpful(row.routine_helpful) ? row.routine_helpful : null,
  };
}

export async function setRoutineFeedback(scanId: string, helpful: RoutineHelpful): Promise<void> {
  const { error } = await supabase.rpc('set_routine_feedback', { p_scan_id: scanId, p_helpful: helpful });
  if (error) throw new Error('set-routine-feedback-failed');
}

export async function fetchLatestScan(): Promise<Scan | null> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('fetch-latest-scan-failed');
  return data ? rowToScan(data as Record<string, unknown>) : null;
}

export async function fetchScanHistory(limit = 30): Promise<Scan[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('fetch-scan-history-failed');
  return (data ?? []).map((r) => rowToScan(r as Record<string, unknown>));
}
