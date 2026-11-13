import XCTest
import CoreVideo
import ImageIO
import Vision
@testable import AppleVisionCore

final class VisionTests: XCTestCase {
  private func blankExif7JPEG() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
    let context = try XCTUnwrap(CGContext(data: nil, width: 400, height: 600, bitsPerComponent: 8,
      bytesPerRow: 1600, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
    context.setFillColor(CGColor(gray: 0, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: 400, height: 600))
    let image = try XCTUnwrap(context.makeImage())
    let destination = try XCTUnwrap(CGImageDestinationCreateWithURL(url as CFURL, "public.jpeg" as CFString, 1, nil))
    CGImageDestinationAddImage(destination, image, [kCGImagePropertyOrientation: 7] as CFDictionary)
    XCTAssertTrue(CGImageDestinationFinalize(destination))
    return url
  }
  func testPositiveStillObservationKeepsBoundsAndUnknownPose() throws {
    let url = try blankExif7JPEG()
    defer { try? FileManager.default.removeItem(at: url) }
    let observation = VNFaceObservation(requestRevision: VNDetectFaceRectanglesRequestRevision3,
      boundingBox: CGRect(x: 0.1, y: 0.2, width: 0.4, height: 0.5), roll: nil, yaw: nil, pitch: nil)
    var calls = 0
    let result = try VisionEngine.detectStillForTesting(uri: url.absoluteString) { _, _ in
      calls += 1
      return [observation]
    }
    XCTAssertEqual(calls, 1)
    XCTAssertEqual(result.faces.count, 1)
    let face = try XCTUnwrap(result.faces.first)
    XCTAssertEqual(face.x * result.imageWidth, 60, accuracy: 0.0001)
    XCTAssertEqual(face.y * result.imageHeight, 120, accuracy: 0.0001)
    XCTAssertEqual(face.width * result.imageWidth, 240, accuracy: 0.0001)
    XCTAssertEqual(face.height * result.imageHeight, 200, accuracy: 0.0001)
    XCTAssertEqual(result.imageWidth, 600)
    XCTAssertEqual(result.imageHeight, 400)
    XCTAssertNil(face.yawAngle)
    XCTAssertNil(face.rollAngle)
  }
  func testRealRequestThroughNitroExposedStillEntryPoint() throws {
    let url = try blankExif7JPEG()
    defer { try? FileManager.default.removeItem(at: url) }
    let completedBefore = VisionEngine.completedRequests
    let bridged = try HybridAppleVisionDetector().detectStill(uri: url.absoluteString)
    XCTAssertEqual(VisionEngine.completedRequests, completedBefore + 1)
    XCTAssertEqual(bridged.imageWidth, 600)
    XCTAssertEqual(bridged.imageHeight, 400)
    XCTAssertTrue(bridged.faces.isEmpty)
  }
  func testPositiveObservationSurvivesRealDetectionResultPathWithUnknownPose() throws {
    var buffer: CVPixelBuffer?
    XCTAssertEqual(CVPixelBufferCreate(nil, 640, 480, kCVPixelFormatType_32BGRA, nil, &buffer), kCVReturnSuccess)
    let observation = VNFaceObservation(requestRevision: VNDetectFaceRectanglesRequestRevision3,
      boundingBox: CGRect(x: 0.1, y: 0.2, width: 0.4, height: 0.5), roll: nil, yaw: nil, pitch: nil)
    var calls = 0
    let result = try VisionEngine.detectForTesting(pixelBuffer: XCTUnwrap(buffer), orientation: .right) { _, _ in
      calls += 1
      return [observation]
    }
    XCTAssertEqual(calls, 1)
    XCTAssertEqual(result.faces.count, 1)
    let face = try XCTUnwrap(result.faces.first)
    XCTAssertEqual(face.x, 0.1, accuracy: 0.0001)
    XCTAssertEqual(face.y, 0.3, accuracy: 0.0001)
    XCTAssertEqual(face.width, 0.4, accuracy: 0.0001)
    XCTAssertEqual(face.height, 0.5, accuracy: 0.0001)
    XCTAssertEqual(result.imageWidth, 480)
    XCTAssertEqual(result.imageHeight, 640)
    XCTAssertNil(face.yawAngle)
    XCTAssertNil(face.rollAngle)
  }
  func testLowerLeftVisionBoundsBecomeTopLeftWithoutInventingPose() {
    let bounds = CGRect(x: 0.1, y: 0.2, width: 0.4, height: 0.5)
    let face = VisionGeometry.face(bounds: bounds, yaw: .pi / 6, roll: -.pi / 4)
    XCTAssertEqual(face?.x ?? -1, 0.1, accuracy: 0.0001)
    XCTAssertEqual(face?.y ?? -1, 0.3, accuracy: 0.0001)
    XCTAssertEqual(face?.yawAngle ?? -1, 30, accuracy: 0.0001)
    XCTAssertEqual(face?.rollAngle ?? -1, -45, accuracy: 0.0001)
    XCTAssertNotNil(VisionGeometry.face(bounds: bounds, yaw: nil, roll: 0))
    XCTAssertNil(VisionGeometry.face(bounds: bounds, yaw: nil, roll: 0)?.yawAngle)
    XCTAssertNotNil(VisionGeometry.face(bounds: bounds, yaw: 0, roll: nil))
    XCTAssertNil(VisionGeometry.face(bounds: bounds, yaw: 0, roll: nil)?.rollAngle)
  }
  func testAllExifOrientationsHaveCorrectUprightDimensions() {
    for raw in UInt32(1)...8 {
      let size = VisionGeometry.uprightSize(width: 640, height: 480, orientation: CGImagePropertyOrientation(rawValue: raw)!)
      XCTAssertEqual(size.width, raw >= 5 ? 480 : 640)
      XCTAssertEqual(size.height, raw >= 5 ? 640 : 480)
    }
  }
  func testInvalidGeometryIsRejected() {
    for bounds in [CGRect.zero, CGRect(x: -1, y: 0, width: 1, height: 1)] {
      XCTAssertNil(VisionGeometry.face(bounds: bounds, yaw: 0, roll: 0))
    }
  }
  func testBlankSyntheticBufferHasNoFaces() throws {
    var buffer: CVPixelBuffer?
    XCTAssertEqual(CVPixelBufferCreate(nil, 64, 64, kCVPixelFormatType_32BGRA, nil, &buffer), kCVReturnSuccess)
    let pixelBuffer = try XCTUnwrap(buffer)
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    memset(CVPixelBufferGetBaseAddress(pixelBuffer), 0, CVPixelBufferGetDataSize(pixelBuffer))
    CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
    let result = try VisionEngine.detect(pixelBuffer: pixelBuffer, orientation: .up)
    XCTAssertEqual(result.faces.count, 0)
    XCTAssertEqual(result.imageWidth, 64)
    XCTAssertEqual(result.imageHeight, 64)
  }
  func testRealRequestThroughNitroExposedFrameEntryPoint() throws {
    struct Frame: HybridFrameSpec, NativeFrame {
      let sampleBuffer: CMSampleBuffer?
      let orientation = HostFrameOrientation.right
      let isMirrored = true
    }
    var buffer: CVPixelBuffer?
    XCTAssertEqual(CVPixelBufferCreate(nil, 320, 240, kCVPixelFormatType_32BGRA, nil, &buffer), kCVReturnSuccess)
    let pixelBuffer = try XCTUnwrap(buffer)
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    memset(CVPixelBufferGetBaseAddress(pixelBuffer), 0, CVPixelBufferGetDataSize(pixelBuffer))
    CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
    var format: CMVideoFormatDescription?
    XCTAssertEqual(CMVideoFormatDescriptionCreateForImageBuffer(allocator: nil, imageBuffer: pixelBuffer,
      formatDescriptionOut: &format), noErr)
    var sample: CMSampleBuffer?
    var timing = CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: .zero, decodeTimeStamp: .invalid)
    XCTAssertEqual(CMSampleBufferCreateReadyWithImageBuffer(allocator: nil, imageBuffer: pixelBuffer,
      formatDescription: try XCTUnwrap(format), sampleTiming: &timing, sampleBufferOut: &sample), noErr)
    let completedBefore = VisionEngine.completedRequests
    let result = try HybridAppleVisionDetector().detectFrame(frame: Frame(sampleBuffer: try XCTUnwrap(sample)))
    XCTAssertEqual(VisionEngine.completedRequests, completedBefore + 1)
    XCTAssertEqual(result.imageWidth, 240)
    XCTAssertEqual(result.imageHeight, 320)
    XCTAssertTrue(result.faces.isEmpty)
  }
  func testStillRejectsNetworkAndMissingLocalFiles() {
    XCTAssertThrowsError(try VisionEngine.detectStill(uri: "https://example.com/face.jpg"))
    XCTAssertThrowsError(try VisionEngine.detectStill(uri: "file:///missing-synthetic-file.jpg"))
  }
}
