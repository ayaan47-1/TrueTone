// Money is held as integer micro-dollars (1e-6 USD) so reservations and budgets never drift
// through floating-point arithmetic. Values are server-side only; nothing here is client supplied.
const USD = /^(\d{1,9})(?:\.(\d{1,6}))?$/;

export function parseUsdToMicros(s: string): number | null {
  const m = USD.exec(s);
  if (!m) return null;
  const frac = (m[2] ?? '').padEnd(6, '0');
  return Number(m[1]) * 1_000_000 + Number(frac);
}

export function formatMicros(micros: number): string {
  const whole = Math.floor(micros / 1_000_000);
  const frac = String(micros % 1_000_000).padStart(6, '0');
  return `${whole}.${frac}`;
}

/** Token cost in micro-dollars, rounded up. Prices are micro-dollars per million tokens. */
export function tokenCostMicros(
  inputTokens: number, outputTokens: number,
  inputMicrosPerMTok: number, outputMicrosPerMTok: number,
): number {
  return Math.ceil((inputTokens * inputMicrosPerMTok + outputTokens * outputMicrosPerMTok) / 1_000_000);
}
