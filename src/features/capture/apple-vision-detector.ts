import { Platform } from 'react-native';
import type { AppleVisionDetector } from '../../../packages/apple-vision/src/AppleVisionDetector.nitro';

export function createFaceDetector(): AppleVisionDetector {
  if (Platform.OS !== 'ios') throw new Error('Face detection is available only in the Apple Vision iOS build');
  const { createAppleVisionDetector }: typeof import('@truetone/apple-vision') = require('@truetone/apple-vision');
  return createAppleVisionDetector();
}
