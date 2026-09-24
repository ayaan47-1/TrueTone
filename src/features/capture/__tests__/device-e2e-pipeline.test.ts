// Host proof of the scan → shade → ranked-product chain the founder repeats on a device.
// Device-only pieces (JPEG decode, face detection, file delete) are faked; everything between
// them is the real code path: CvReadEngine → runRead → personalization → For You ranking.
import { CvReadEngine } from '../../read/cv-read-engine';
import { runRead } from '../../read/run-read';
import { personalization } from '../../session/personalization';
import { resolveForYouProfile } from '../../foryou/for-you-profile';
import { rankedForFilter } from '../../match/sort';
import { catalog } from '../../match/product-catalog';
import { solidRgb } from '../../read/cv/fixtures';
import type { ScanEvidence } from '../device-evidence';

const URI = 'file:///tmp/capture.jpg';

function engineWith(opts: { failDecode?: boolean; deleted: string[]; evidence: ScanEvidence[] }) {
  return new CvReadEngine({
    decode: async () => {
      if (opts.failDecode) throw new Error('decode failed');
      return { rgb: solidRgb(120, 120, [180, 140, 120]), sourceSize: { width: 120, height: 120 } };
    },
    detect: async () => ({ bounds: { x: 0, y: 0, width: 120, height: 120 } }),
    cleanup: async (u) => { opts.deleted.push(u); },
    onEvidence: (e) => { opts.evidence.push(e); },
  });
}

beforeEach(() => personalization.reset());

test('scan → shade → ranked products, with the image deleted', async () => {
  const deleted: string[] = [];
  const evidence: ScanEvidence[] = [];
  const persist = jest.fn().mockResolvedValue(undefined);

  await runRead(URI, { engine: engineWith({ deleted, evidence }), persist });

  expect(deleted).toEqual([URI]);
  expect(persist).toHaveBeenCalledTimes(1);
  const { hasScanned, currentShade } = personalization.getState();
  expect(hasScanned).toBe(true);
  expect(currentShade).not.toBeNull();

  const profile = resolveForYouProfile(hasScanned, currentShade, { coverage: 'everyday', skips: [] } as never, false);
  expect(profile).toMatchObject({ shade: currentShade!.depth, undertone: currentShade!.undertone });
  const ranked = rankedForFilter(catalog, profile!, 'all');
  expect(ranked.length).toBeGreaterThan(0);
  expect(ranked[0].isBestMatch).toBe(true);
  expect(ranked.filter((r) => r.isBestMatch)).toHaveLength(1);
  for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].fit).toBeGreaterThanOrEqual(ranked[i].fit);
  ranked.forEach((r) => {
    expect(r.fit).toBeGreaterThanOrEqual(40);
    expect(r.fit).toBeLessThanOrEqual(99);
  });

  expect(evidence).toEqual([
    expect.objectContaining({ kind: 'scan', readOk: true, imageDeleted: true, clipPass: true }),
  ]);
});

test('a failed read still deletes the image, sets no shade, and the next scan recovers', async () => {
  const deleted: string[] = [];
  const evidence: ScanEvidence[] = [];

  await expect(
    new CvReadEngine({
      decode: async () => { throw new Error('decode failed'); },
      cleanup: async (u) => { deleted.push(u); },
      onEvidence: (e) => { evidence.push(e); },
    }).run(URI),
  ).rejects.toThrow('decode failed');
  expect(deleted).toEqual([URI]);
  expect(personalization.getState().currentShade).toBeNull();
  expect(evidence).toEqual([expect.objectContaining({ readOk: false, imageDeleted: true })]);

  await runRead(URI, { engine: engineWith({ deleted, evidence }), persist: jest.fn().mockResolvedValue(undefined) });
  expect(deleted).toEqual([URI, URI]);
  expect(personalization.getState().currentShade).not.toBeNull();
  expect(evidence[1]).toMatchObject({ readOk: true, imageDeleted: true });
});

test('reports imageDeleted:false when every delete attempt fails', async () => {
  const evidence: ScanEvidence[] = [];
  const engine = new CvReadEngine({
    decode: async () => ({ rgb: solidRgb(40, 40), sourceSize: { width: 40, height: 40 } }),
    detect: async () => null,
    cleanup: async () => { throw new Error('delete failed'); },
    onEvidence: (e) => { evidence.push(e); },
  });
  await engine.run(URI);
  expect(evidence).toEqual([expect.objectContaining({ readOk: true, imageDeleted: false })]);
});
