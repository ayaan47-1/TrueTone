import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

export interface VisionFace {
  x: number;
  y: number;
  width: number;
  height: number;
  yawAngle?: number;
  rollAngle?: number;
}
export interface VisionResult {
  imageWidth: number;
  imageHeight: number;
  faces: VisionFace[];
}
export interface AppleVisionDetector extends HybridObject<{ ios: 'swift' }> {
  detectFrame(frame: Frame): VisionResult;
  detectStill(uri: string): VisionResult;
}
