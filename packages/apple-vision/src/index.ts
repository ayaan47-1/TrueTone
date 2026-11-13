import { NitroModules } from 'react-native-nitro-modules';
import type { AppleVisionDetector } from './AppleVisionDetector.nitro';

export function createAppleVisionDetector(): AppleVisionDetector {
  return NitroModules.createHybridObject<AppleVisionDetector>('AppleVisionDetector');
}
