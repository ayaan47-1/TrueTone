// M1 (MASVS review): the profile photo must live in ONE app-owned folder under a non-identifying
// name, the previous photo must go when it is replaced, and Delete My Data / Delete Account must be
// able to remove the folder idempotently.
import { createAvatarFileStore, type AvatarFs } from '../avatar-file';

const DIR = 'file:///cache/truetone-avatar/';

function fakeFs(initial: string[] = []): AvatarFs & { files: Set<string>; failDelete: Set<string> } {
  const files = new Set(initial);
  const failDelete = new Set<string>();
  return {
    files,
    failDelete,
    root: 'file:///cache/',
    makeDirectory: jest.fn(async () => undefined),
    copy: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      if (!files.has(from)) throw new Error('missing source');
      files.add(to);
    }),
    remove: jest.fn(async (uri: string) => {
      if (failDelete.has(uri)) throw new Error('locked');
      for (const f of [...files]) if (f === uri || f.startsWith(uri)) files.delete(f);
    }),
    list: jest.fn(async () => [...files].filter((f) => f.startsWith(DIR)).map((f) => f.slice(DIR.length))),
  };
}

test('adopt copies the picked image into the app-owned folder under a non-identifying name and removes the picker copy', async () => {
  const fs = fakeFs(['file:///cache/ImagePicker/ABC-123.jpg']);
  const store = createAvatarFileStore(fs, () => 1700000000000);
  const result = await store.adopt('file:///cache/ImagePicker/ABC-123.jpg');
  expect(result.uri).toBe(`${DIR}avatar-1700000000000.jpg`);
  expect(result.cleanupComplete).toBe(true);
  expect(fs.files.has(result.uri)).toBe(true);
  expect(fs.files.has('file:///cache/ImagePicker/ABC-123.jpg')).toBe(false);
});

test('replacing the photo deletes the previous managed image', async () => {
  const fs = fakeFs([`${DIR}avatar-1.jpg`, 'file:///cache/ImagePicker/new.jpg']);
  const store = createAvatarFileStore(fs, () => 2);
  const result = await store.adopt('file:///cache/ImagePicker/new.jpg');
  expect(fs.files.has(`${DIR}avatar-1.jpg`)).toBe(false);
  expect([...fs.files]).toEqual([result.uri]);
});

test('a failed delete of the previous image is reported, not swallowed, and the new photo is kept', async () => {
  const fs = fakeFs([`${DIR}avatar-1.jpg`, 'file:///cache/ImagePicker/new.jpg']);
  fs.failDelete.add(`${DIR}avatar-1.jpg`);
  const store = createAvatarFileStore(fs, () => 2);
  const result = await store.adopt('file:///cache/ImagePicker/new.jpg');
  expect(result.cleanupComplete).toBe(false);
  expect(fs.files.has(result.uri)).toBe(true);
});

test('wipe removes every managed avatar file', async () => {
  const fs = fakeFs([`${DIR}avatar-1.jpg`, `${DIR}avatar-2.jpg`]);
  await createAvatarFileStore(fs).wipe();
  expect(fs.files.size).toBe(0);
  expect(fs.remove).toHaveBeenCalledWith(DIR);
});

test('wipe is idempotent when no avatar exists', async () => {
  const fs = fakeFs();
  await expect(createAvatarFileStore(fs).wipe()).resolves.toBeUndefined();
});

test('wipe rejects when the file cannot be deleted so the caller can surface a retry', async () => {
  const fs = fakeFs([`${DIR}avatar-1.jpg`]);
  fs.failDelete.add(DIR);
  await expect(createAvatarFileStore(fs).wipe()).rejects.toThrow();
});

test('isManaged recognises only files inside the app-owned folder', () => {
  const store = createAvatarFileStore(fakeFs());
  expect(store.isManaged(`${DIR}avatar-1.jpg`)).toBe(true);
  expect(store.isManaged('file:///cache/ImagePicker/x.jpg')).toBe(false);
});

test('wipe also removes photos an earlier build left in the image picker cache folder', async () => {
  const fs = fakeFs(['file:///cache/ImagePicker/legacy.jpg', `${DIR}avatar-1.jpg`]);
  await createAvatarFileStore(fs).wipe();
  expect(fs.files.size).toBe(0);
  expect(fs.remove).toHaveBeenCalledWith('file:///cache/ImagePicker/');
});

// Toby round-2 MEDIUM: on an upgraded device the current photo is still an earlier build's
// picker-cache file (ImagePicker/old.jpg), not a managed copy. Replacing it must delete it too.
test('replacing the photo on an upgraded device deletes the legacy picker-cache photo', async () => {
  const fs = fakeFs(['file:///cache/ImagePicker/old.jpg', 'file:///cache/ImagePicker/new.jpg']);
  const store = createAvatarFileStore(fs, () => 3);
  const result = await store.adopt('file:///cache/ImagePicker/new.jpg');
  expect(fs.files.has('file:///cache/ImagePicker/old.jpg')).toBe(false);
  expect([...fs.files]).toEqual([result.uri]);
  expect(result.cleanupComplete).toBe(true);
});

test('a failed delete of the legacy picker-cache folder is reported as incomplete cleanup', async () => {
  const fs = fakeFs(['file:///cache/ImagePicker/old.jpg', 'file:///cache/ImagePicker/new.jpg']);
  fs.failDelete.add('file:///cache/ImagePicker/');
  const store = createAvatarFileStore(fs, () => 3);
  const result = await store.adopt('file:///cache/ImagePicker/new.jpg');
  expect(result.cleanupComplete).toBe(false);
  expect(fs.files.has(result.uri)).toBe(true);
});
