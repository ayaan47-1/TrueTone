import { supabase } from './supabase';
import { DIMENSIONS, SCORE_COLUMNS } from '../content/cosmetic-vocab';
import type { ReadResult, ScoreVector } from '../features/read/read-types';

export interface Scan {
  id: string;
  capturedAt: string;
  skinType: string;
  scores: ScoreVector;
  modelVersion: string;
  isStub: boolean;
}

export async function recordScan(r: ReadResult): Promise<void> {
  const { error } = await supabase.rpc('record_scan', {
    p_scores: r.scores,
    p_skin_type: r.skinType,
    p_model_version: r.modelVersion,
    p_is_stub: r.isStub,
  });
  if (error) throw new Error('record-scan-failed');
}

function rowToScan(row: Record<string, unknown>): Scan {
  const scores = Object.fromEntries(
    DIMENSIONS.map((d) => [d, Number(row[SCORE_COLUMNS[d]])]),
  ) as ScoreVector;
  return {
    id: String(row.id),
    capturedAt: String(row.captured_at),
    skinType: String(row.skin_type_feel),
    scores,
    modelVersion: String(row.model_version),
    isStub: Boolean(row.is_stub),
  };
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
