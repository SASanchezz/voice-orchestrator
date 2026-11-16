// A pop-up's text field that your words fill while you talk, from any app: what the field held when the recording
// started, then your words. The orchestrator sends what happens to the recording as lines on stdin:
//   {"command":"voice","kind":"started"|"words"|"send"|"kept"|"ended"|"cancelled","words":"…"}
// "send" puts your final words in and sends the field as its Send button would; "kept" leaves them there to edit;
// "ended" and "cancelled" put back what the field held. While your words fill it, it can't be typed into.
// A panel with such a field prints "front" when it comes to the front and on every click, so the orchestrator knows
// which pop-up you see, and "edit" on a click into the field while your words fill it, to stop and edit them.
// Compiled together with the panels that have a field (see src/macos/native-helper.ts).
import AppKit

struct VoiceCommand: Decodable {
  let command: String
  let kind: String?
  let words: String?
}

final class VoiceField {
  private let field: NSTextField
  private var typedBefore = ""
  private(set) var isFollowing = false

  init(_ field: NSTextField) {
    self.field = field
  }

  /// Runs `line` if it is a voice command, and says whether it was; `send` sends what the field holds.
  func run(_ line: Data, send: () -> Void) -> Bool {
    guard let voice = try? JSONDecoder().decode(VoiceCommand.self, from: line), voice.command == "voice" else {
      return false
    }
    follow(voice.kind ?? "", words: voice.words ?? "", send: send)
    return true
  }

  func isClicked(by event: NSEvent) -> Bool {
    isFollowing && field.bounds.contains(field.convert(event.locationInWindow, from: nil))
  }

  private func follow(_ kind: String, words: String, send: () -> Void) {
    switch kind {
    case "started": start()
    case "words": show(words)
    case "send":
      stop(with: words)
      send()
    case "kept": stop(with: words)
    case "ended", "cancelled": stop(with: "")
    default: break
    }
  }

  private func start() {
    typedBefore = field.stringValue
    isFollowing = true
    field.isEditable = false
  }

  private func show(_ words: String) {
    guard isFollowing else { return }
    let needsSpace = !words.isEmpty && !typedBefore.isEmpty && !(typedBefore.last?.isWhitespace ?? false)
    field.stringValue = typedBefore + (needsSpace ? " " : "") + words
  }

  private func stop(with words: String) {
    show(words)
    isFollowing = false
    field.isEditable = true
  }
}

/// A pop-up that prints "seen" on your first click since it last came to the front and, once it has a voice field,
/// "front" and "edit" as above.
class VoicePanel: NSPanel {
  var voice: VoiceField?
  private var seen = false

  override func sendEvent(_ event: NSEvent) {
    if event.type == .leftMouseDown { reportClick(event) }
    super.sendEvent(event)
  }

  /// Brought up again, so the next click is a first one again.
  func cameToFront() {
    seen = false
    if voice != nil { report("front") }
  }

  private func reportClick(_ event: NSEvent) {
    if !seen {
      seen = true
      report("seen")
    }
    guard let voice else { return }
    report("front")
    if voice.isClicked(by: event) { report("edit") }
  }
}

func report(_ line: String) {
  print(line)
  fflush(stdout)
}

/// Runs each whole line from stdin on the main thread, in order; stdin closing (the orchestrator quit) exits.
func readStdinLines(_ run: @escaping (Data) -> Void) {
  var unread = Data()
  FileHandle.standardInput.readabilityHandler = { input in
    let chunk = input.availableData
    if chunk.isEmpty { exit(0) }
    DispatchQueue.main.async {
      unread.append(chunk)
      while let end = unread.firstIndex(of: UInt8(ascii: "\n")) {
        let line = Data(unread[unread.startIndex..<end])
        unread = Data(unread[unread.index(after: end)...])
        run(line)
      }
    }
  }
}
