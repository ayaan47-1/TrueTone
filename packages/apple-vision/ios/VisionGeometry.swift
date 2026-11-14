import Foundation
import ImageIO

struct LocalFace {
  let x: Double
  let y: Double
  let width: Double
  let height: Double
  let yawAngle: Double?
  let rollAngle: Double?
}
struct LocalDetection {
  let imageWidth: Double
  let imageHeight: Double
  let faces: [LocalFace]
}

enum VisionGeometry {
  static func uprightSize(width: Double, height: Double, orientation: CGImagePropertyOrientation) -> CGSize {
    switch orientation {
    case .left, .right, .leftMirrored, .rightMirrored: return CGSize(width: height, height: width)
    default: return CGSize(width: width, height: height)
    }
  }

  static func face(bounds: CGRect, yaw: Double?, roll: Double?) -> LocalFace? {
    guard bounds.minX.isFinite, bounds.minY.isFinite, bounds.width.isFinite, bounds.height.isFinite,
          bounds.width > 0, bounds.height > 0, bounds.minX >= 0, bounds.minY >= 0,
          bounds.maxX <= 1, bounds.maxY <= 1 else { return nil }
    return LocalFace(x: bounds.minX, y: 1 - bounds.maxY, width: bounds.width, height: bounds.height,
      yawAngle: yaw.flatMap { $0.isFinite ? $0 * 180 / .pi : nil },
      rollAngle: roll.flatMap { $0.isFinite ? $0 * 180 / .pi : nil })
  }
}
