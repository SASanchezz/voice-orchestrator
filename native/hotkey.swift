// Watches one key system-wide and prints "ready", then "down" / "up" lines, to stdout.
// Usage: hotkey <mac virtual keycode>. Exits when stdin closes (the parent process is gone).
// The event tap runs on this process's own main run loop, which is what macOS requires.
import CoreGraphics
import Foundation

let modifierFlagByKeycode: [Int64: UInt64] = [
  54: 0x10,      // right command
  55: 0x08,      // left command
  56: 0x02,      // left shift
  60: 0x04,      // right shift
  58: 0x20,      // left option
  61: 0x40,      // right option
  59: 0x01,      // left control
  62: 0x2000,    // right control
  63: 0x800000,  // fn
]

// Side-agnostic modifier flags. The session's key state can report a held right-side modifier as up,
// but these flags are always set while either side is held.
let genericModifierFlagByKeycode: [Int64: CGEventFlags] = [
  54: .maskCommand, 55: .maskCommand,
  56: .maskShift, 60: .maskShift,
  58: .maskAlternate, 61: .maskAlternate,
  59: .maskControl, 62: .maskControl,
  63: .maskSecondaryFn,
]

guard CommandLine.arguments.count == 2, let keycodeArgument = Int64(CommandLine.arguments[1]) else {
  FileHandle.standardError.write("usage: hotkey <keycode>\n".data(using: .utf8)!)
  exit(64)
}

if !CGPreflightListenEventAccess() {
  CGRequestListenEventAccess()
  FileHandle.standardError.write("Input Monitoring permission is missing.\n".data(using: .utf8)!)
  exit(2)
}

// Static state, because a C event-tap callback cannot capture variables.
enum WatchedKey {
  nonisolated(unsafe) static var keycode: Int64 = 0
  nonisolated(unsafe) static var isDown = false
  nonisolated(unsafe) static var tap: CFMachPort?

  static func report(_ down: Bool) {
    guard down != isDown else { return }  // drops key auto-repeat
    isDown = down
    print(down ? "down" : "up")
    fflush(stdout)
  }

  /// Reports "up" if the key is no longer held but its release never reached the tap
  /// (the tap was disabled for a moment, or a secure input field swallowed the event).
  static func releaseIfMissed() {
    guard isDown, !isStillHeld() else { return }
    report(false)
  }

  static func isStillHeld() -> Bool {
    if CGEventSource.keyState(.combinedSessionState, key: CGKeyCode(keycode)) { return true }
    guard let flag = genericModifierFlagByKeycode[keycode] else { return false }
    return CGEventSource.flagsState(.combinedSessionState).contains(flag)
  }

  static func isPressed(_ type: CGEventType, _ event: CGEvent) -> Bool {
    if type == .flagsChanged, let flag = modifierFlagByKeycode[keycode] {
      return event.flags.rawValue & flag != 0
    }
    return type == .keyDown
  }
}
WatchedKey.keycode = keycodeArgument

let eventMask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue) | (1 << CGEventType.flagsChanged.rawValue)
let tap = CGEvent.tapCreate(
  tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly,
  eventsOfInterest: CGEventMask(eventMask),
  callback: { _, type, event, _ in
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
      if let tap = WatchedKey.tap { CGEvent.tapEnable(tap: tap, enable: true) }
      WatchedKey.releaseIfMissed()
    } else if event.getIntegerValueField(.keyboardEventKeycode) == WatchedKey.keycode {
      WatchedKey.report(WatchedKey.isPressed(type, event))
    }
    return Unmanaged.passUnretained(event)
  },
  userInfo: nil)

guard let tap else {
  FileHandle.standardError.write("Could not create the keyboard event tap.\n".data(using: .utf8)!)
  exit(2)
}
WatchedKey.tap = tap

CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(nil, tap, 0), .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

// Safety net for a lost key-up: while the key counts as held, check that it really still is.
let releaseCheckSeconds = 0.2
Timer.scheduledTimer(withTimeInterval: releaseCheckSeconds, repeats: true) { _ in WatchedKey.releaseIfMissed() }

print("ready")
fflush(stdout)

DispatchQueue.global().async {
  while readLine() != nil {}
  exit(0)
}

CFRunLoopRun()
