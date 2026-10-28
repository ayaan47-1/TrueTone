import { supabase, SUPABASE_OFFLINE } from './supabase';
import { DIMENSIONS, SCORE_COLUMNS } from '../content/cosmetic-vocab';
import type { ReadResult, ScoreVector } from '../features/read/read-types';
import { buildRoutine } from '../features/recommend/routine-engine';
import { skincareDomain } from '../features/recommend/skincare/domain';
import type { Routine } from '../features/recommend/routine-types';
import type { SkinAgeEstimate } from '../features/age/age-types';
import { type RoutineHelpful, isRoutineHelpful } from '../features/feedback/types';
import type { CurrentShade } from '../features/session/personalization';
import { type ShadeLabels, toShadeLabels } from '../features/shade/shade-history';

export type CaptureMode = 'pair' | 'single';

/** Optional shade-history fields for recordScan: labels only, never raw tone numbers. */
export interface ScanShadeExtras {
  shade?: CurrentShade | null;
  captureMode?: CaptureMode | null;
}

/** One saved shade match for the "Your recent matches" list. */
export interface ShadeMatchEntry {
  id: string;
  capturedAt: string;
  shade: ShadeLabels;
}

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
  shade: ShadeLabels | null;
  captureMode: CaptureMode | null;
}

export const SCAN_HISTORY_PAGE_SIZE = 30;

export async function recordScan(
  r: ReadResult,
  age: SkinAgeEstimate | null = null,
  captureQuality: 'good' | 'fair' | 'poor' | null = null,
  extras: ScanShadeExtras = {},
): Promise<void> {
  const routine = buildRoutine(skincareDomain, { scores: r.scores, skinType: r.skinType });
  if (SUPABASE_OFFLINE) {
    recordLocalScan(r, routine, age, captureQuality ?? r.captureQuality ?? null, extras);
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
    p_shade: extras.shade ? toShadeLabels(extras.shade) : null,
    p_capture_mode: extras.captureMode ?? null,
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
  extras: ScanShadeExtras,
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
    shade: extras.shade ? toShadeLabels(extras.shade) : null,
    captureMode: extras.captureMode ?? null,
  };
  localScans = [scan, ...localScans];
}

/** Camera build only: drops every on-device scan (Your Data -> delete). */
export function clearCameraDemoScans(): void {
  localScans = [];
}

function rowToShade(row: Record<string, unknown>): ShadeLabels | null {
  if (row.shade_name == null) return null;
  return {
    depthBand: String(row.shade_depth_band) as ShadeLabels['depthBand'],
    undertone: String(row.shade_undertone) as ShadeLabels['undertone'],
    finish: String(row.shade_finish) as ShadeLabels['finish'],
    shadeName: String(row.shade_name),
  };
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
    shade: rowToShade(row),
    captureMode: row.capture_mode == null ? null : (String(row.capture_mode) as CaptureMode),
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

export async function fetchScanHistory(limit = SCAN_HISTORY_PAGE_SIZE): Promise<Scan[]> {
  if (SUPABASE_OFFLINE) return localScans.slice(0, limit);
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('fetch-scan-history-failed');
  return (data ?? []).map((r) => rowToScan(r as Record<string, unknown>));
}

/** The user's last few matched shades (labels only; no scores), newest first. */
export async function fetchRecentShadeMatches(limit = 5): Promise<ShadeMatchEntry[]> {
  const { data, error } = await supabase
    .from('scans')
    .select('id, captured_at, shade_depth_band, shade_undertone, shade_finish, shade_name')
    .not('shade_name', 'is', null)
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error('fetch-shade-history-failed');
  return (data ?? []).flatMap((r) => {
    const row = r as Record<string, unknown>;
    const shade = rowToShade(row);
    return shade ? [{ id: String(row.id), capturedAt: String(row.captured_at), shade }] : [];
  });
}

/** Removes saved shade/capture labels while preserving the scan record and its other fields. */
export async function clearShadeHistory(): Promise<void> {
  if (SUPABASE_OFFLINE) {
    localScans = localScans.map((scan) => ({ ...scan, shade: null, captureMode: null }));
    return;
  }
  const { error } = await supabase.rpc('clear_shade_history');
  if (error) throw new Error('clear-shade-history-failed');
}
