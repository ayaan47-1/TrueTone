import CoreMedia
import ImageIO
#if !APPLE_VISION_HOST_TESTING
import NitroModules
import VisionCamera
#endif

final class HybridAppleVisionDetector: HybridAppleVisionDetectorSpec {
  // Each invocation owns its request. No frame, image, geometry or tracking state survives it.
  func detectFrame(frame: any HybridFrameSpec) throws -> VisionResult {
    guard let native = frame as? any NativeFrame,
          let sample = native.sampleBuffer,
          let buffer = CMSampleBufferGetImageBuffer(sample) else { throw VisionFailure.invalidFrame }
    let orientation: CGImagePropertyOrientation
    switch frame.orientation {
    case .up: orientation = frame.isMirrored ? .upMirrored : .up
    case .down: orientation = frame.isMirrored ? .downMirrored : .down
    case .left: orientation = frame.isMirrored ? .leftMirrored : .left
    case .right: orientation = frame.isMirrored ? .rightMirrored : .right
    }
    return bridge(try VisionEngine.detect(pixelBuffer: buffer, orientation: orientation))
  }

  func detectStill(uri: String) throws -> VisionResult {
    bridge(try VisionEngine.detectStill(uri: uri))
  }

  private func bridge(_ result: LocalDetection) -> VisionResult {
    VisionResult(imageWidth: result.imageWidth, imageHeight: result.imageHeight, faces: result.faces.map {
      VisionFace(x: $0.x, y: $0.y, width: $0.width, height: $0.height, yawAngle: $0.yawAngle, rollAngle: $0.rollAngle)
    })
  }
}
