import { writeUprightStill, JPEG_QUALITY } from '../capture-upright';
import type { CapturedPhoto, CapturedImage } from '../capture-upright';
import type { PhotoOrientation } from '../photo-orientation';

interface ImageLog {
  rotations: Array<{ degrees: number; fastFlag: boolean | undefined }>;
  saves: Array<{ format: string; quality: number | undefined }>;
  disposed: number;
}

function fakeImage(size: { width: number; height: number }, log: ImageLog, path = '/tmp/upright.jpg'): CapturedImage {
  return {
    width: size.width,
    height: size.height,
    async rotateAsync(degrees, allowFastFlagRotation) {
      log.rotations.push({ degrees, fastFlag: allowFastFlagRotation });
      const swap = degrees === 90 || degrees === 270;
      return fakeImage(
        swap ? { width: size.height, height: size.width } : size,
        log,
        '/tmp/rotated.jpg',
      );
    },
    async saveToTemporaryFileAsync(format, quality) {
      log.saves.push({ format, quality });
      return path;
    },
    dispose() {
      log.disposed += 1;
    },
  };
}

interface PhotoOpts {
  orientation?: PhotoOrientation;
  isMirrored?: boolean;
  size?: { width: number; height: number };
  imageSize?: { width: number; height: number };
  toImageThrows?: boolean;
}

function fakePhoto(opts: PhotoOpts, log: ImageLog) {
  const size = opts.size ?? { width: 3648, height: 2736 };
  const state = { disposed: 0, fellBackToFile: false };
  const photo: CapturedPhoto = {
    orientation: opts.orientation ?? 'left',
    isMirrored: opts.isMirrored ?? false,
    width: size.width,
    height: size.height,
    async toImageAsync() {
      if (opts.toImageThrows) throw new Error('raw photo');
      return fakeImage(opts.imageSize ?? { width: size.height, height: size.width }, log);
    },
    async saveToTemporaryFileAsync() {
      state.fellBackToFile = true;
      return '/tmp/sensor.jpg';
    },
    dispose() {
      state.disposed += 1;
    },
  };
  return { photo, state };
}

const emptyLog = (): ImageLog => ({ rotations: [], saves: [], disposed: 0 });

describe('writeUprightStill', () => {
  it('writes the converted image, un-rotated, when the conversion already applied orientation', async () => {
    const log = emptyLog();
    const { photo, state } = fakePhoto({ orientation: 'left' }, log);

    const { uri, meta } = await writeUprightStill(photo);

    expect(log.rotations).toEqual([]);
    expect(log.saves).toEqual([{ format: 'jpg', quality: JPEG_QUALITY }]);
    expect(uri).toBe('file:///tmp/upright.jpg');
    expect(meta.orientationCheck).toEqual({ applied: true, residualDegrees: 0 });
    expect(meta.correctedDegrees).toBe(0);
    expect(meta.degradedReason).toBeNull();
    expect(meta.sensorSize).toEqual({ width: 3648, height: 2736 });
    expect(meta.uprightSize).toEqual({ width: 2736, height: 3648 });
    expect(state.fellBackToFile).toBe(false);
  });

  // The Fold 7 failure: the sensor buffer comes back landscape and nothing rotated it.
  it('rotates the pixels itself when the conversion left the buffer sideways', async () => {
    const log = emptyLog();
    const sensor = { width: 3648, height: 2736 };
    const { photo } = fakePhoto({ orientation: 'left', size: sensor, imageSize: sensor }, log);

    const { meta } = await writeUprightStill(photo);

    expect(log.rotations).toEqual([{ degrees: 90, fastFlag: false }]);
    expect(meta.correctedDegrees).toBe(90);
    expect(meta.orientationCheck.applied).toBe(false);
    expect(meta.uprightSize).toEqual({ width: 2736, height: 3648 });
  });

  // allowFastFlagRotation would set an EXIF flag instead of moving pixels — which reintroduces
  // precisely the bug, because MLKit and jpeg-js disagree about honouring that flag.
  it('never lets the rotation be a metadata-only flag', async () => {
    const log = emptyLog();
    const sensor = { width: 3648, height: 2736 };
    const { photo } = fakePhoto({ orientation: 'right', size: sensor, imageSize: sensor }, log);

    await writeUprightStill(photo);

    expect(log.rotations).toHaveLength(1);
    expect(log.rotations[0].fastFlag).toBe(false);
    expect(log.rotations[0].degrees).toBe(270);
  });

  it('does not rotate when the sizes carry no evidence', async () => {
    const log = emptyLog();
    const { photo } = fakePhoto({ orientation: 'up' }, log);

    const { meta } = await writeUprightStill(photo);

    expect(log.rotations).toEqual([]);
    expect(meta.orientationCheck.applied).toBeNull();
    expect(meta.correctedDegrees).toBe(0);
  });

  it('falls back to the raw sensor file, and says so, when conversion fails', async () => {
    const log = emptyLog();
    const { photo, state } = fakePhoto({ toImageThrows: true }, log);

    const { uri, meta } = await writeUprightStill(photo);

    expect(state.fellBackToFile).toBe(true);
    expect(uri).toBe('file:///tmp/sensor.jpg');
    expect(meta.degradedReason).toMatch(/raw photo/);
    expect(meta.orientationCheck.applied).toBeNull();
    expect(meta.uprightSize).toEqual({ width: 3648, height: 2736 });
  });

  it('releases the native photo and every image it created', async () => {
    const log = emptyLog();
    const sensor = { width: 3648, height: 2736 };
    const { photo, state } = fakePhoto({ orientation: 'left', size: sensor, imageSize: sensor }, log);

    await writeUprightStill(photo);

    expect(state.disposed).toBe(1);
    expect(log.disposed).toBe(2); // the converted image and the rotated one
  });

  it('releases the native photo even when saving throws', async () => {
    const log = emptyLog();
    const { photo, state } = fakePhoto({}, log);
    photo.toImageAsync = async () => ({
      width: 2736,
      height: 3648,
      rotateAsync: async () => {
        throw new Error('unreachable');
      },
      saveToTemporaryFileAsync: async () => {
        throw new Error('disk full');
      },
      dispose() {
        log.disposed += 1;
      },
    });

    await expect(writeUprightStill(photo)).rejects.toThrow('disk full');
    expect(state.disposed).toBe(1);
    expect(log.disposed).toBe(1);
  });

  it('carries mirroring through untouched, for the overlay to report', async () => {
    const log = emptyLog();
    const { photo } = fakePhoto({ isMirrored: true }, log);
    const { meta } = await writeUprightStill(photo);
    expect(meta.isMirrored).toBe(true);
  });

  it('leaves an already-prefixed path alone', async () => {
    const log = emptyLog();
    const { photo } = fakePhoto({}, log);
    photo.toImageAsync = async () => fakeImage({ width: 2736, height: 3648 }, log, 'file:///tmp/x.jpg');
    const { uri } = await writeUprightStill(photo);
    expect(uri).toBe('file:///tmp/x.jpg');
  });
});

// Device pass, Fold 7, 2026-07-26. The conversion swapped the axes as required, so every size
// check passed, and the written face was upside down — see conversionResidualDegrees.
describe('writeUprightStill: mirrored quarter-turn correction', () => {
  it('applies a half turn when the conversion rotated a mirrored frame', async () => {
    const log = emptyLog();
    const { photo } = fakePhoto({ orientation: 'right', isMirrored: true }, log);

    const { meta } = await writeUprightStill(photo);

    expect(log.rotations).toEqual([{ degrees: 180, fastFlag: false }]);
    expect(meta.correctedDegrees).toBe(180);
    expect(meta.correctionReason).toBe('mirrored-quarter-turn');
    // A half turn preserves the portrait shape the conversion already produced.
    expect(meta.uprightSize).toEqual({ width: 2736, height: 3648 });
  });

  it('leaves an un-mirrored frame alone', async () => {
    const log = emptyLog();
    const { photo } = fakePhoto({ orientation: 'right', isMirrored: false }, log);

    const { meta } = await writeUprightStill(photo);

    expect(log.rotations).toEqual([]);
    expect(meta.correctedDegrees).toBe(0);
    expect(meta.correctionReason).toBeNull();
  });

  // Correcting on top of our own rotation would introduce the error, not remove it.
  it('does not stack the half turn on top of a rotation it applied itself', async () => {
    const log = emptyLog();
    const sensor = { width: 3648, height: 2736 };
    const { photo } = fakePhoto(
      { orientation: 'right', isMirrored: true, size: sensor, imageSize: sensor },
      log,
    );

    const { meta } = await writeUprightStill(photo);

    expect(log.rotations).toEqual([{ degrees: 270, fastFlag: false }]);
    expect(meta.correctedDegrees).toBe(270);
    expect(meta.correctionReason).toBe('residual');
  });
});
