import { visionPreviewFaces, visionStillFaces } from '../apple-vision-mapping';

const result = {
  imageWidth: 400, imageHeight: 600,
  faces: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.5, yawAngle: 12, rollAngle: -7 }],
};

test('still detection maps normalized upright coordinates to source pixels', () => {
  expect(visionStillFaces(result)).toEqual([
    { bounds: { x: 40, y: 120, width: 160, height: 300 } },
  ]);
});

test('front preview mirrors once and uses centered aspect-fill, not stretched bounds', () => {
  const [face] = visionPreviewFaces(result, { width: 300, height: 600 });
  expect(face.bounds.x).toBeCloseTo(150);
  expect(face.bounds.y).toBeCloseTo(120);
  expect(face.bounds.width).toBeCloseTo(160);
  expect(face.bounds.height).toBeCloseTo(300);
  expect(face.yawAngle).toBe(-12);
  expect(face.rollAngle).toBe(7);
});

test('empty detections stay empty', () => {
  expect(visionStillFaces({ ...result, faces: [] })).toEqual([]);
  expect(visionPreviewFaces({ ...result, faces: [] }, { width: 300, height: 600 })).toEqual([]);
});

test.each([
  { ...result, imageWidth: 0 },
  { ...result, faces: [{ ...result.faces[0], yawAngle: null }] },
  { ...result, faces: [{ ...result.faces[0], rollAngle: NaN }] },
  { ...result, faces: [{ ...result.faces[0], x: -0.1 }] },
  { ...result, faces: [{ ...result.faces[0], width: 2 }] },
])('invalid native geometry never clears the capture gate', (raw) => {
  expect(() => visionPreviewFaces(raw, { width: 300, height: 600 })).toThrow();
});

test('invalid viewport cannot produce a face', () => {
  expect(() => visionPreviewFaces(result, { width: 0, height: 600 })).toThrow();
});
