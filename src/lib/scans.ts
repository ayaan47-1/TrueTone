import { supabase, SUPABASE_OFFLINE } from './supabase';
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
  captureQuality: 'good' | 'fair' | 'poor' | null;
}

export async function recordScan(
  r: ReadResult,
  age: SkinAgeEstimate | null = null,
  captureQuality: 'good' | 'fair' | 'poor' | null = null,
): Promise<void> {
  const routine = buildRoutine(skincareDomain, { scores: r.scores, skinType: r.skinType });
  if (SUPABASE_OFFLINE) {
    recordLocalScan(r, routine, age, captureQuality ?? r.captureQuality ?? null);
    return;
  }
  const { error } = await supabase.rpc('record_scan', {
    p_scores: r.scores,
    p_skin_type: r.skinType,
    p_model_version: r.modelVersion,
    p_is_stub: r.isStub,
    p_routine: routine,
    p_routine_version: routine.version,
    p_skin_age: age?.ageEstimate ?? null,
    p_skin_age_confidence: age?.confidence ?? null,
    p_capture_quality: captureQuality ?? r.captureQuality ?? null,
  });
  if (error) throw new Error('record-scan-failed');
}

// Camera-build scan store (Dwight FAIL on PR #60): under SUPABASE_OFFLINE the derived scores stay
// in memory on this device for this app session, newest first. The image itself is never here; the
// on-device engine has already deleted it (CLAUDE.md §3). Nothing is written to disk or sent anywhere.
let localScans: readonly Scan[] = [];
let localScanSeq = 0;

function recordLocalScan(
  r: ReadResult,
  routine: Routine,
  age: SkinAgeEstimate | null,
  captureQuality: 'good' | 'fair' | 'poor' | null,
): void {
  localScanSeq += 1;
  const scan: Scan = {
    id: `local-scan-${localScanSeq}`,
    capturedAt: new Date().toISOString(),
    skinType: r.skinType,
    scores: r.scores,
    modelVersion: r.modelVersion,
    isStub: r.isStub,
    routine,
    skinAge: age?.ageEstimate ?? null,
    skinAgeConfidence: age?.confidence ?? null,
    routineHelpful: null,
    captureQuality,
  };
  localScans = [scan, ...localScans];
}

/** Camera build only: drops every on-device scan (Your Data -> delete). */
export function clearCameraDemoScans(): void {
  localScans = [];
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
    captureQuality: row.capture_quality == null ? null : (String(row.capture_quality) as 'good' | 'fair' | 'poor'),
  };
}

export async function setRoutineFeedback(scanId: string, helpful: RoutineHelpful): Promise<void> {
  if (SUPABASE_OFFLINE) {
    localScans = localScans.map((scan) => (scan.id === scanId ? { ...scan, routineHelpful: helpful } : scan));
    return;
  }
  const { error } = await supabase.rpc('set_routine_feedback', { p_scan_id: scanId, p_helpful: helpful });
  if (error) throw new Error('set-routine-feedback-failed');
}

export async function fetchLatestScan(): Promise<Scan | null> {
  if (SUPABASE_OFFLINE) return localScans[0] ?? null;
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
  if (SUPABASE_OFFLINE) return localScans.slice(0, limit);
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('fetch-scan-history-failed');
  return (data ?? []).map((r) => rowToScan(r as Record<string, unknown>));
}
