import {
  classifyDetection,
  describeOutcome,
  reportModuleUnavailable,
  reportThrew,
} from '../still-detection-diagnostics';

const face = (bounds: unknown) => ({ bounds });

describe('classifyDetection', () => {
  it('reports ok when a face came back with readable bounds', () => {
    const r = classifyDetection([face({ x: 1, y: 2, width: 3, height: 4 })], 1);
    expect(r.outcome).toBe('ok');
    expect(r.rawCount).toBe(1);
    expect(r.error).toBeNull();
  });

  // The distinction that matters most: MLKit genuinely saw nothing...
  it('separates a genuine miss from a shape it could not read', () => {
    expect(classifyDetection([], 0).outcome).toBe('empty');
    // ...versus faces arriving that the bounds reader rejected. Same `null` downstream, opposite fix.
    expect(classifyDetection([face(null), face(undefined)], 0).outcome).toBe('unusable-shape');
  });

  it('counts what came back when the shape is unusable', () => {
    const r = classifyDetection([face(null), face(null), face(null)], 0);
    expect(r.rawCount).toBe(3);
  });

  it('flags a return value that is not a list at all', () => {
    expect(classifyDetection({ faces: [] }, 0).outcome).toBe('not-a-list');
    expect(classifyDetection(null, 0).outcome).toBe('not-a-list');
    expect(classifyDetection(undefined, 0).outcome).toBe('not-a-list');
  });

  it('surfaces the first entry’s property names', () => {
    const r = classifyDetection([{ bounds: null, yawAngle: 0 }], 0);
    expect(r.firstKeys).toEqual(['bounds', 'yawAngle']);
  });

  // A Nitro HybridObject keeps its properties on a prototype, so Object.keys sees nothing. An empty
  // key list next to 'unusable-shape' is therefore evidence about WHICH bug this is.
  it('reports no keys for an object whose properties live on a prototype', () => {
    const hybrid = Object.create({ bounds: { x: 0, y: 0, width: 1, height: 1 } });
    const r = classifyDetection([hybrid], 0);
    expect(r.outcome).toBe('unusable-shape');
    expect(r.firstKeys).toEqual([]);
  });

  it('does not crash on a null first entry', () => {
    expect(classifyDetection([null], 0).firstKeys).toEqual([]);
  });
});

describe('failure reports', () => {
  it('carries the message off a thrown Error', () => {
    expect(reportThrew(new Error('boom'))).toEqual({
      outcome: 'threw',
      rawCount: 0,
      error: 'boom',
      firstKeys: [],
    });
  });

  it('stringifies a non-Error throw', () => {
    expect(reportThrew('plain string').error).toBe('plain string');
    expect(reportModuleUnavailable({ code: 1 }).error).toBe('[object Object]');
  });

  it('distinguishes a missing module from a failed call', () => {
    expect(reportModuleUnavailable(new Error('x')).outcome).toBe('module-unavailable');
    expect(reportThrew(new Error('x')).outcome).toBe('threw');
  });
});

describe('describeOutcome', () => {
  it('gives every outcome a non-empty, actionable line', () => {
    const reports = [
      classifyDetection([face({ x: 1, y: 1, width: 1, height: 1 })], 1),
      classifyDetection([], 0),
      classifyDetection([face(null)], 0),
      classifyDetection('nope', 0),
      reportThrew(new Error('bad uri')),
      reportModuleUnavailable(new Error('not linked')),
    ];
    for (const r of reports) {
      expect(describeOutcome(r).length).toBeGreaterThan(20);
    }
  });

  it('names the URI prefix as the thing to try when the call threw', () => {
    expect(describeOutcome(reportThrew(new Error('ENOENT')))).toContain('file://');
  });

  it('names the HybridObject shape when nothing enumerated', () => {
    const hybrid = Object.create({ bounds: {} });
    expect(describeOutcome(classifyDetection([hybrid], 0))).toContain('HybridObject');
  });
});
