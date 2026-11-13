// swift-tools-version: 5.9
import PackageDescription
let package = Package(
  name: "AppleVisionCore", platforms: [.macOS(.v13), .iOS(.v16)],
  products: [.library(name: "AppleVisionCore", targets: ["AppleVisionCore"])],
  targets: [
    .target(name: "AppleVisionCore", path: "ios", sources: ["VisionGeometry.swift", "VisionEngine.swift"]),
    .testTarget(name: "AppleVisionCoreTests", dependencies: ["AppleVisionCore"], path: "Tests")
  ]
)
