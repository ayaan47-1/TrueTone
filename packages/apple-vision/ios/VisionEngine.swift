import Foundation
import CoreVideo
import ImageIO
import Vision

enum VisionFailure: Error { case invalidLocalImage, invalidFrame }

enum VisionEngine {
  private static func request() -> VNDetectFaceRectanglesRequest {
    let request = VNDetectFaceRectanglesRequest()
    #if os(macOS)
    // Host verification does not have access to the iPhone Neural Engine.
    request.usesCPUOnly = true
    #endif
    return request
  }
  private static func result(_ request: VNDetectFaceRectanglesRequest, width: Double, height: Double,
                             orientation: CGImagePropertyOrientation) -> LocalDetection {
    let size = VisionGeometry.uprightSize(width: width, height: height, orientation: orientation)
    let faces = (request.results ?? []).compactMap { observation in
      VisionGeometry.face(bounds: observation.boundingBox, yaw: observation.yaw?.doubleValue, roll: observation.roll?.doubleValue)
    }
    return LocalDetection(imageWidth: size.width, imageHeight: size.height, faces: faces)
  }

  static func detect(pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) throws -> LocalDetection {
    try autoreleasepool {
      let request = request()
      try VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:]).perform([request])
      return result(request, width: Double(CVPixelBufferGetWidth(pixelBuffer)),
        height: Double(CVPixelBufferGetHeight(pixelBuffer)), orientation: orientation)
    }
  }

  static func detectStill(uri: String) throws -> LocalDetection {
    try autoreleasepool {
      // No URLSession, remote schemes, image download or persistent image cache.
      let url: URL
      if uri.hasPrefix("/") { url = URL(fileURLWithPath: uri) }
      else if let local = URL(string: uri), local.isFileURL { url = local }
      else { throw VisionFailure.invalidLocalImage }
      guard let source = CGImageSourceCreateWithURL(url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let width = properties[kCGImagePropertyPixelWidth] as? NSNumber,
            let height = properties[kCGImagePropertyPixelHeight] as? NSNumber,
            width.doubleValue > 0, height.doubleValue > 0 else { throw VisionFailure.invalidLocalImage }
      let raw = (properties[kCGImagePropertyOrientation] as? NSNumber)?.uint32Value ?? 1
      guard let orientation = CGImagePropertyOrientation(rawValue: raw) else { throw VisionFailure.invalidLocalImage }
      let request = request()
      try VNImageRequestHandler(url: url, orientation: orientation, options: [:]).perform([request])
      return result(request, width: width.doubleValue, height: height.doubleValue, orientation: orientation)
    }
  }
}
