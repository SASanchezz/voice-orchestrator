// Prints the bounds of the display under the mouse cursor as "x,y,width,height" in global points,
// the format `screencapture -R` takes. Exits 2 when Screen Recording permission is missing.
import CoreGraphics
import Foundation

let screenRecordingMissingExitCode: Int32 = 2

if !CGPreflightScreenCaptureAccess() {
  CGRequestScreenCaptureAccess()
  FileHandle.standardError.write("Screen Recording permission is missing.\n".data(using: .utf8)!)
  exit(screenRecordingMissingExitCode)
}

let cursor = CGEvent(source: nil)?.location ?? .zero
var displayUnderCursor = CGMainDisplayID()
var matchingDisplays: UInt32 = 0
CGGetDisplaysWithPoint(cursor, 1, &displayUnderCursor, &matchingDisplays)
let bounds = CGDisplayBounds(matchingDisplays > 0 ? displayUnderCursor : CGMainDisplayID())
print("\(Int(bounds.origin.x)),\(Int(bounds.origin.y)),\(Int(bounds.width)),\(Int(bounds.height))")
