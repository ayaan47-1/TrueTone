// SwiftPM host interfaces only. The app uses the generated Nitro C++ types instead.
// This compiles the real HybridAppleVisionDetector implementation on macOS,
// not the iOS JSI/C++ bindings. The unsigned iOS build remains a separate gate.
import CoreMedia

enum HostFrameOrientation { case up, down, left, right }
protocol HybridFrameSpec {
  var orientation: HostFrameOrientation { get }
  var isMirrored: Bool { get }
}
protocol NativeFrame { var sampleBuffer: CMSampleBuffer? { get } }
class HybridAppleVisionDetectorSpec {}
struct VisionFace {
  let x, y, width, height: Double
  let yawAngle, rollAngle: Double?
}
struct VisionResult {
  let imageWidth, imageHeight: Double
  let faces: [VisionFace]
}
