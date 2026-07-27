import { readExifOrientation, applyOrientation } from '../exif-orientation';
import { solidRgb, fillRect } from '../cv/fixtures';

// Minimal JPEG APP1/EXIF header carrying a single Orientation tag (0x0112), big-endian.
function jpegWithOrientation(value: number): Uint8Array {
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,   // 'MM', 42, IFD0 offset 8
    0x00, 0x01,                                        // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,    // tag 0x0112, SHORT, count 1
    (value >> 8) & 0xff, value & 0xff, 0x00, 0x00,     // value
    0x00, 0x00, 0x00, 0x00,                            // next IFD = 0
  ];
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // 'Exif\0\0' + TIFF
  const len = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...exif]);
}

describe('readExifOrientation', () => {
  it('reads orientation 6 (rotate 90 CW)', () => {
    expect(readExifOrientation(jpegWithOrientation(6))).toBe(6);
  });
  it('reads orientation 8 (rotate 270 CW)', () => {
    expect(readExifOrientation(jpegWithOrientation(8))).toBe(8);
  });
  it('defaults to 1 when there is no EXIF block', () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0]))).toBe(1);
  });
  it('defaults to 1 on truncated or malformed input rather than throwing', () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]))).toBe(1);
    expect(readExifOrientation(new Uint8Array([]))).toBe(1);
  });
});

describe('applyOrientation', () => {
  const marked = () => fillRect(solidRgb(8, 4, [10, 10, 10]), { x: 0, y: 0, w: 2, h: 1 }, [255, 0, 0]);
  const pixel = (img: any, x: number, y: number) => {
    const i = (y * img.width + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };

  it('returns the image unchanged for orientation 1', () => {
    const src = marked();
    expect(Array.from(applyOrientation(src, 1).data)).toEqual(Array.from(src.data));
  });

  it('swaps width and height for 90-degree rotations', () => {
    const out = applyOrientation(marked(), 6);
    expect(out.width).toBe(4);
    expect(out.height).toBe(8);
  });

  it('keeps dimensions for a 180-degree rotation', () => {
    const out = applyOrientation(marked(), 3);
    expect([out.width, out.height]).toEqual([8, 4]);
  });

  it('moves the top-left marker to the top-right under orientation 6', () => {
    const out = applyOrientation(marked(), 6);
    expect(pixel(out, out.width - 1, 0)).toEqual([255, 0, 0]);
  });

  it('moves the top-left marker to the bottom-right under orientation 3', () => {
    const out = applyOrientation(marked(), 3);
    expect(pixel(out, out.width - 1, out.height - 1)).toEqual([255, 0, 0]);
  });

  it('composes back to the original after four 90-degree rotations', () => {
    const src = marked();
    let out = src;
    for (let i = 0; i < 4; i++) out = applyOrientation(out, 6);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('does not mutate its input', () => {
    const src = marked();
    const before = Array.from(src.data);
    applyOrientation(src, 6);
    expect(Array.from(src.data)).toEqual(before);
  });
});
