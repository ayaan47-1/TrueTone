// src/features/identity/avatar-file.ts
// MASVS M1: the profile photo may be a selfie, so it lives in ONE app-owned folder under a
// non-identifying name (the cache folder: excluded from device backups on iOS and Android).
// Replacing the photo deletes the previous file; Delete My Data / Delete Account remove the whole
// folder through wipe(). The picker's own copy is removed once adopted. Nothing here ever leaves
// the device -- the URI is local state only (see community-profile-repository.ts).

export interface AvatarFs {
  /** Base folder the avatar folder lives under (expo-file-system cacheDirectory). */
  root: string | null;
  makeDirectory(uri: string): Promise<void>;
  copy(args: { from: string; to: string }): Promise<void>;
  /** Deletes a file or folder; must not throw when it is already gone. */
  remove(uri: string): Promise<void>;
  /** File names inside a folder; [] when the folder does not exist. */
  list(uri: string): Promise<string[]>;
}

export interface AdoptResult {
  uri: string;
  /** false when an older avatar (or the picker copy) could not be deleted. */
  cleanupComplete: boolean;
}

export interface AvatarFileStore {
  adopt(pickedUri: string): Promise<AdoptResult>;
  wipe(): Promise<void>;
  isManaged(uri: string | null | undefined): boolean;
}

const FOLDER = 'truetone-avatar/';
// expo-image-picker's own cache folder: earlier builds kept the picked photo here (MASVS M1).
const PICKER_FOLDER = 'ImagePicker/';

function defaultFs(): AvatarFs {
  // Lazy-required so the native module never enters the Jest module graph.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system/legacy');
  return {
    root: FileSystem.cacheDirectory ?? null,
    makeDirectory: (uri) => FileSystem.makeDirectoryAsync(uri, { intermediates: true }),
    copy: (args) => FileSystem.copyAsync(args),
    remove: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
    list: async (uri) => {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? FileSystem.readDirectoryAsync(uri) : [];
    },
  };
}

async function settleAll(tasks: Promise<void>[]): Promise<boolean> {
  const results = await Promise.allSettled(tasks);
  return results.every((r) => r.status === 'fulfilled');
}

export function createAvatarFileStore(
  fs: AvatarFs = defaultFs(),
  now: () => number = Date.now,
): AvatarFileStore {
  const dir = (): string => {
    if (!fs.root) throw new Error('avatar storage unavailable');
    return `${fs.root}${FOLDER}`;
  };

  return {
    async adopt(pickedUri) {
      const folder = dir();
      await fs.makeDirectory(folder);
      const name = `avatar-${now()}.jpg`;
      const uri = `${folder}${name}`;
      await fs.copy({ from: pickedUri, to: uri });
      const older = (await fs.list(folder)).filter((n) => n !== name);
      const cleanupComplete = await settleAll([
        fs.remove(pickedUri),
        ...older.map((n) => fs.remove(`${folder}${n}`)),
      ]);
      return { uri, cleanupComplete };
    },
    async wipe() {
      if (!fs.root) return;
      // Both removals run; either failure rejects so the caller can surface a retry.
      const ok = await settleAll([fs.remove(dir()), fs.remove(`${fs.root}${PICKER_FOLDER}`)]);
      if (!ok) throw new Error('profile photo could not be deleted');
    },
    isManaged(uri) {
      return !!uri && !!fs.root && uri.startsWith(dir());
    },
  };
}

let shared: AvatarFileStore | null = null;
/** App-wide store; created on first use so tests that never touch avatars load no native code. */
export function avatarFileStore(): AvatarFileStore {
  shared ??= createAvatarFileStore();
  return shared;
}
