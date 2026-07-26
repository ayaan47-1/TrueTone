// app/(dev)/bbox-overlay.tsx
//
// DEVICE-ONLY, DEV-ONLY diagnostic screen (plan Task 15). Draws MLKit's detected bounds and the
// derived sampling regions on top of the captured photo, so EXIF agreement between MLKit and the
// jpeg-js decode is VERIFIED rather than assumed (spec §3a, §11).
//
// Why this screen has to exist: the frame-consistency guard in face-geometry.ts catches coordinate
// SCALE mismatch, not coordinate FRAME mismatch. It was measured to accept EXIF 90 degree
// transposition, 180 degree flip, and front-camera mirroring. A wrong transform therefore mis-places
// every sampling region with no error, no exception, and no test failure. Only a human looking at
// the boxes on a real face can settle it.
//
// COMPLIANCE (CLAUDE.md §1, §3): this screen holds a face image on screen, so it is fenced hard.
// It renders nothing outside __DEV__. The photo is read locally, never sent off-device, never
// logged, and deleted on retake and on unmount. It mirrors cv-read-engine.ts exactly rather than
// re-deriving the transform, so what you see here is what the read actually samples.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Capture } from '../../src/features/capture/Capture';
import { decodeJpegToRgb, base64ToBytes } from '../../src/features/read/decode-rgb';
import { detectFacesOnStill } from '../../src/features/read/detect-faces-still';
import {
  deriveRegionsForFace,
  isPlausibleFaceDetection,
  scaleFaceToWorkingSpace,
  type DetectedFace,
} from '../../src/features/read/face-geometry';
import { readExifOrientation } from '../../src/features/read/exif-orientation';
import { REGION_NAMES, type RegionName, type Regions } from '../../src/features/read/cv/types';

const DISPLAY_EDGE = 320;

// Distinct colours so a single mis-placed region is identifiable, not just "the boxes look wrong".
const REGION_COLORS: Record<(typeof REGION_NAMES)[number], string> = {
  cheekL: '#34d399',
  cheekR: '#22d3ee',
  infraorbitalL: '#a78bfa',
  infraorbitalR: '#f472b6',
  forehead: '#facc15',
  periocularL: '#fb923c',
  periocularR: '#f87171',
  tZone: '#ffffff',
};

// Which regions form left/right anatomical pairs. Mirroring cannot be detected in software — a
// mirrored face is still a perfectly plausible face — so these are labelled ON the image and the
// human settles it. See the "mirroring" note in the render.
const SIDE_LABEL: Partial<Record<RegionName, string>> = {
  cheekL: 'L',
  cheekR: 'R',
  infraorbitalL: 'L',
  infraorbitalR: 'R',
  periocularL: 'L',
  periocularR: 'R',
};

interface Analysis {
  workingSize: { width: number; height: number };
  sourceSize: { width: number; height: number };
  exifOrientation: number | null;
  rawFace: DetectedFace | null;
  scaledFace: DetectedFace | null;
  regions: Regions;
  source: 'contours' | 'bounds' | 'fallback';
  contourKeys: string[];
  /** Bounds fit the frame BOTH as-is and transposed — the guard cannot tell the two apart. */
  orientationAmbiguous: boolean;
}

const boundsRect = (f: DetectedFace) => ({
  x: f.bounds.x,
  y: f.bounds.y,
  w: f.bounds.width,
  h: f.bounds.height,
});

async function readOrientation(uri: string): Promise<number | null> {
  try {
    // Same lazy-require dance as decode-rgb.ts: on SDK 56 readAsStringAsync lives on the legacy
    // subpath, and neither module may enter the Jest graph.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const legacy = require('expo-file-system/legacy');
    const fs =
      legacy && typeof legacy.readAsStringAsync === 'function'
        ? legacy
        : // eslint-disable-next-line @typescript-eslint/no-var-requires
          require('expo-file-system');
    const b64: string = await fs.readAsStringAsync(uri, { encoding: 'base64' });
    return readExifOrientation(base64ToBytes(b64));
  } catch {
    return null;
  }
}

// Mirrors CvReadEngine.run's transform chain step for step. Any divergence here would make the
// overlay reassuring and wrong, which is worse than having no overlay.
async function analyze(uri: string): Promise<Analysis> {
  const { rgb, sourceSize } = await decodeJpegToRgb(uri);
  const workingSize = { width: rgb.width, height: rgb.height };
  const exifOrientation = await readOrientation(uri);

  let rawFace: DetectedFace | null = null;
  try {
    rawFace = await detectFacesOnStill(uri);
  } catch {
    rawFace = null;
  }

  const scaledFace = scaleFaceToWorkingSpace(rawFace, sourceSize, workingSize);
  const { regions, source } = deriveRegionsForFace(scaledFace, workingSize);

  // ORIENTATION: the plausibility guard only asks "do these bounds fit this frame?". If they fit
  // the transposed frame equally well, a 90 degree disagreement between MLKit and the decode would
  // sail straight through it. Detecting that ambiguity is the most the software can do; which of
  // the two is actually right still needs the eye test below.
  const transposed = { width: sourceSize.height, height: sourceSize.width };
  const orientationAmbiguous =
    !!rawFace &&
    isPlausibleFaceDetection(boundsRect(rawFace), sourceSize) &&
    isPlausibleFaceDetection(boundsRect(rawFace), transposed);

  return {
    workingSize,
    sourceSize,
    exifOrientation,
    rawFace,
    scaledFace,
    regions,
    source,
    contourKeys: rawFace?.contours ? Object.keys(rawFace.contours) : [],
    orientationAmbiguous,
  };
}

const rect = (r: { x: number; y: number; w: number; h: number }) =>
  `x${Math.round(r.x)} y${Math.round(r.y)} w${Math.round(r.w)} h${Math.round(r.h)}`;

export default function BboxOverlay() {
  const params = useLocalSearchParams<{ uri?: string }>();
  const [uri, setUri] = useState<string | null>(params.uri ?? null);
  // Only delete files this screen captured. A URI passed in by hand belongs to the caller.
  const ownsFile = useRef(!params.uri);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discard = useCallback((target: string | null) => {
    if (!target || !ownsFile.current) return;
    void FileSystem.deleteAsync(target, { idempotent: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    setAnalysis(null);
    setError(null);
    analyze(uri)
      .then((a) => {
        if (!cancelled) setAnalysis(a);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  // Never leave a face image on disk when the screen goes away.
  const uriRef = useRef(uri);
  uriRef.current = uri;
  useEffect(() => () => discard(uriRef.current), [discard]);

  const retake = useCallback(() => {
    discard(uri);
    ownsFile.current = true;
    setUri(null);
    setAnalysis(null);
    setError(null);
  }, [discard, uri]);

  if (!__DEV__) return null;

  if (!uri) {
    return (
      <Capture
        onCaptured={(photoUri) => {
          ownsFile.current = true;
          setUri(photoUri);
        }}
        onCancel={() => {}}
      />
    );
  }

  const k = analysis ? DISPLAY_EDGE / Math.max(analysis.workingSize.width, analysis.workingSize.height) : 0;
  const boxW = analysis ? analysis.workingSize.width * k : 0;
  const boxH = analysis ? analysis.workingSize.height * k : 0;
  const guardRejected = !!analysis?.rawFace && !analysis?.scaledFace;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {!analysis && !error && <Text style={styles.body}>Decoding…</Text>}
      {error && <Text style={styles.bad}>Error: {error}</Text>}

      {analysis && (
        <>
          {/* Container matches the decoded aspect ratio exactly, so `contain` letterboxes by zero
              pixels and the box coordinates need no centering offset. */}
          <View style={{ width: boxW, height: boxH }}>
            <Image source={{ uri }} style={{ width: boxW, height: boxH }} resizeMode="contain" />
            {analysis.scaledFace && (
              <View
                style={[
                  styles.bounds,
                  {
                    left: analysis.scaledFace.bounds.x * k,
                    top: analysis.scaledFace.bounds.y * k,
                    width: analysis.scaledFace.bounds.width * k,
                    height: analysis.scaledFace.bounds.height * k,
                  },
                ]}
              />
            )}
            {REGION_NAMES.map((n) => (
              <View
                key={n}
                style={{
                  position: 'absolute',
                  borderWidth: 1,
                  borderColor: REGION_COLORS[n],
                  left: analysis.regions[n].x * k,
                  top: analysis.regions[n].y * k,
                  width: analysis.regions[n].w * k,
                  height: analysis.regions[n].h * k,
                }}
              >
                {SIDE_LABEL[n] && (
                  <Text style={[styles.sideLabel, { color: REGION_COLORS[n] }]}>{SIDE_LABEL[n]}</Text>
                )}
              </View>
            ))}
          </View>

          <Text style={[styles.headline, analysis.source === 'contours' ? styles.good : styles.warn]}>
            source: {analysis.source}
          </Text>
          {analysis.source === 'bounds' && (
            <Text style={styles.warn}>MLKit returned no usable contours — regions came from the bbox.</Text>
          )}
          {analysis.source === 'fallback' && (
            <Text style={styles.bad}>
              No face reached region derivation — regions are the proportional guess. Check the two lines
              below to see whether the detector found nothing or the guard threw it away.
            </Text>
          )}
          {guardRejected && (
            <Text style={styles.bad}>
              GUARD REJECTED a real detection (isPlausibleFaceDetection). The detector and the decode
              disagree about the frame.
            </Text>
          )}

          <Text style={styles.body}>decoded (working): {analysis.workingSize.width}×{analysis.workingSize.height}</Text>
          <Text style={styles.body}>source (full-res): {analysis.sourceSize.width}×{analysis.sourceSize.height}</Text>
          <Text style={styles.body}>detector found a face: {analysis.rawFace ? 'yes' : 'no'}</Text>
          <Text style={styles.body}>
            raw bounds: {analysis.rawFace ? rect({
              x: analysis.rawFace.bounds.x,
              y: analysis.rawFace.bounds.y,
              w: analysis.rawFace.bounds.width,
              h: analysis.rawFace.bounds.height,
            }) : '—'}
          </Text>
          <Text style={styles.body}>
            scaled bounds: {analysis.scaledFace ? rect({
              x: analysis.scaledFace.bounds.x,
              y: analysis.scaledFace.bounds.y,
              w: analysis.scaledFace.bounds.width,
              h: analysis.scaledFace.bounds.height,
            }) : '—'}
          </Text>
          <Text style={styles.body}>
            contours ({analysis.contourKeys.length}): {analysis.contourKeys.join(', ') || '—'}
          </Text>

          {/* ---- The two checks this screen exists for (spec §11) ---- */}
          <Text style={styles.section}>orientation / EXIF</Text>
          <Text style={styles.body}>
            EXIF tag: {analysis.exifOrientation ?? 'unreadable'}
            {analysis.exifOrientation && analysis.exifOrientation !== 1
              ? ' — the decode rotated the image. MLKit may or may not have.'
              : ' — no rotation applied by the decode.'}
          </Text>
          {!analysis.rawFace ? (
            // Was previously printing the reassuring green line below even with NO bounds, which
            // is vacuously true and actively misleading — the first real device run hit exactly
            // that case. No detection means the orientation check never ran.
            <Text style={styles.bad}>
              No detection, so the orientation check did NOT run. This is not a pass. A landscape
              still (see the decoded/source sizes above) with a portrait face is the likely cause —
              MLKit will usually miss a 90°-rotated face.
            </Text>
          ) : analysis.orientationAmbiguous ? (
            <Text style={styles.warn}>
              AMBIGUOUS: these bounds fit the frame both as-is and transposed, so the plausibility
              guard cannot rule out a 90° disagreement. Settle it by eye: the forehead box must sit
              on the forehead, not on a cheek or an ear.
            </Text>
          ) : (
            <Text style={styles.good}>
              Bounds fit only the upright frame — a 90° disagreement would have been rejected.
            </Text>
          )}

          <Text style={styles.section}>front-camera mirroring</Text>
          <Text style={styles.body}>
            Not software-detectable: a mirrored face is still a plausible face, so no guard can catch
            it. Verify by eye — touch your LEFT cheek. The box labelled “L” must be on the cheek you
            touched. If “L” is on your right cheek, the still is mirrored relative to what the region
            names assert.
          </Text>
          <Text style={styles.footnote}>
            A pure L/R swap does not change baseline (both cheeks are averaged), but it does swap
            every per-side region — record it either way.
          </Text>

          <Text style={styles.section}>regions (working space)</Text>
          {REGION_NAMES.map((n) => (
            <Text key={n} style={[styles.mono, { color: REGION_COLORS[n] }]}>
              {n}: {rect(analysis.regions[n])}
            </Text>
          ))}
        </>
      )}

      <Pressable style={styles.btn} onPress={retake}>
        <Text style={styles.btnText}>Capture again</Text>
      </Pressable>
      <Text style={styles.footnote}>
        Dev diagnostic. The photo stays on this device and is deleted when you retake or leave.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b0f14' },
  content: { padding: 16, gap: 4 },
  bounds: { position: 'absolute', borderWidth: 2, borderColor: '#fde047' },
  headline: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  section: { color: '#94a3b8', fontSize: 13, marginTop: 12, marginBottom: 2 },
  body: { color: '#e2e8f0', fontSize: 13 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  sideLabel: { fontSize: 10, fontWeight: '700', marginLeft: 1 },
  good: { color: '#34d399' },
  warn: { color: '#fbbf24' },
  bad: { color: '#f87171' },
  btn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  btnText: { color: '#e2e8f0', fontWeight: '600' },
  footnote: { color: '#64748b', fontSize: 11, marginTop: 8 },
});
