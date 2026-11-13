import XCTest
import CoreVideo
import ImageIO
@testable import AppleVisionCore

final class VisionTests: XCTestCase {
  func testLowerLeftVisionBoundsBecomeTopLeftWithoutInventingPose() {
    let bounds = CGRect(x: 0.1, y: 0.2, width: 0.4, height: 0.5)
    let face = VisionGeometry.face(bounds: bounds, yaw: .pi / 6, roll: -.pi / 4)
    XCTAssertEqual(face?.x ?? -1, 0.1, accuracy: 0.0001)
    XCTAssertEqual(face?.y ?? -1, 0.3, accuracy: 0.0001)
    XCTAssertEqual(face?.yawAngle ?? -1, 30, accuracy: 0.0001)
    XCTAssertEqual(face?.rollAngle ?? -1, -45, accuracy: 0.0001)
    XCTAssertNil(VisionGeometry.face(bounds: bounds, yaw: nil, roll: 0))
    XCTAssertNil(VisionGeometry.face(bounds: bounds, yaw: 0, roll: nil))
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
  func testStillRejectsNetworkAndMissingLocalFiles() {
    XCTAssertThrowsError(try VisionEngine.detectStill(uri: "https://example.com/face.jpg"))
    XCTAssertThrowsError(try VisionEngine.detectStill(uri: "file:///missing-synthetic-file.jpg"))
  }
}
