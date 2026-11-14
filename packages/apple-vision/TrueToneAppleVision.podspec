require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'TrueToneAppleVision'
  s.version = package['version']
  s.summary = package['description']
  s.homepage = 'https://github.com/ayaan47-1/TrueTone'
  s.license = { :type => 'Proprietary' }
  s.author = 'TrueTone'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => 'https://github.com/ayaan47-1/TrueTone.git' }
  s.source_files = ['ios/**/*.{swift,h,m,mm,cpp}', 'cpp/**/*.{hpp,cpp}']
  s.frameworks = ['Vision', 'ImageIO', 'CoreMedia']
  s.resource_bundles = { 'TrueToneAppleVisionPrivacy' => ['ios/PrivacyInfo.xcprivacy'] }
  load File.join(__dir__, 'nitrogen/generated/ios/TrueToneAppleVision+autolinking.rb')
  add_nitrogen_files(s)
  s.dependency 'VisionCamera'
  install_modules_dependencies(s)
end
