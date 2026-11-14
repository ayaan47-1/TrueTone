// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "AppleVisionCore", platforms: [.macOS(.v13), .iOS(.v16)],
  products: [.library(name: "AppleVisionCore", targets: ["AppleVisionCore"])],
  targets: [
    .target(name: "AppleVisionCore", path: ".",
      exclude: ["nitrogen", "src", "Tests/VisionTests.swift", "TrueToneAppleVision.podspec",
        "package.json", "nitro.json", "react-native.config.js", "ios/PrivacyInfo.xcprivacy"],
      sources: ["ios/VisionGeometry.swift", "ios/VisionEngine.swift",
      "ios/HybridAppleVisionDetector.swift", "Tests/Support/NitroHost.swift"],
      swiftSettings: [.define("APPLE_VISION_TESTING"), .define("APPLE_VISION_HOST_TESTING")]),
    .testTarget(name: "AppleVisionCoreTests", dependencies: ["AppleVisionCore"], path: "Tests", exclude: ["Support"])
  ]
)
