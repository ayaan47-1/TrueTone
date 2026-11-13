// src/features/capture/e2e-fixture-image.ts
//
// Synthetic capture-step stand-in for E2E_FIXTURE_SCAN (HAG-231). NOT a photo of a real person:
// generated from the SAME synthetic-face builder the fairness self-test already uses
// (eval/fairness/self-test-images.ts's renderSelfTestFace('III') — solid Fitzpatrick-III tone +
// one forehead spot, encoded to JPEG via the project's existing jpeg-js dependency).
//
// Base64 (not a bundled asset file) so it ships with no new native asset pipeline and no
// expo-asset dependency — app/scan/index.tsx writes it to a real file via expo-file-system at
// runtime, exactly once per fixture scan, so downstream code gets a genuine file:// URI.
//
// Decode-provenance tested in src/features/capture/__tests__/e2e-fixture-image.test.ts (Dwight
// review, HAG-231): the string below must decode with jpeg.decode(bytes, { useTArray: true,
// formatAsRGBA: true }) -- the same codec+options as src/features/read/decode-rgb.ts -- at
// exactly 120x120, and must match a FRESH call to the generator below byte for byte. Editing
// this string by hand will fail that test.
//
// Regenerate with `npm run e2e:regen-fixture` (never by hand) -- it runs the committed script
// at eval/fairness/__tests__/e2e-fixture-generator.regen.test.ts, which calls the single-source
// generator function below and rewrites this file.
// Generator: src/features/capture/e2e-fixture-generator.ts (run `npm run e2e:regen-fixture`)
// SHA-256: 287d281c0053cf6e0246f64db804958b456f1556be1731b8dfcdc097db2bfc9d
export const E2E_FIXTURE_IMAGE_BASE64_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAHgAeAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APaK+HPuwoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgDxv4f/AA/1/Q/F1he3th5NrF5m9/OjbGY2A4DE9SK7KlSMotJnDTpyjJNo9krjO4KACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoA//2Q==';
