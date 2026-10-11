// A worker's permission request as a small floating pop-up in the top-right corner, with Allow and Deny.
// It never activates or takes focus: the app you're in (e.g. the browser) stays in front and keeps the keyboard.
// Prints "allow" or "deny" on a click and exits. Each line on stdin replaces the plain-language explanation;
// stdin closing (the orchestrator quit) closes the pop-up.
// Usage: permission-dialog <title> <warning or ""> <command> <allow button label>
import AppKit

let usageExitCode: Int32 = 64
let width: CGFloat = 420
let padding: CGFloat = 16
let screenMargin: CGFloat = 12

let arguments = CommandLine.arguments
guard arguments.count == 5 else {
  FileHandle.standardError.write("usage: permission-dialog <title> <warning> <command> <allow label>\n".data(using: .utf8)!)
  exit(usageExitCode)
}
let (title, warning, command, allowLabel) = (arguments[1], arguments[2], arguments[3], arguments[4])

final class Clicks: NSObject {
  @objc func allow() { answer("allow") }
  @objc func deny() { answer("deny") }

  private func answer(_ word: String) {
    print(word)
    fflush(stdout)
    exit(0)
  }
}

func wrappingLabel(_ text: String, font: NSFont, color: NSColor = .labelColor) -> NSTextField {
  let label = NSTextField(wrappingLabelWithString: text)
  label.font = font
  label.textColor = color
  label.preferredMaxLayoutWidth = width - 2 * padding
  return label
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)  // never becomes the active app, so it never takes focus
let clicks = Clicks()

let explanation = wrappingLabel("", font: .systemFont(ofSize: 13))
explanation.isHidden = true
let warningLabel = wrappingLabel(warning, font: .boldSystemFont(ofSize: 12), color: .systemRed)
warningLabel.isHidden = warning.isEmpty
let commandLabel = wrappingLabel(command, font: .monospacedSystemFont(ofSize: 11, weight: .regular), color: .secondaryLabelColor)

let denyButton = NSButton(title: "Deny", target: clicks, action: #selector(Clicks.deny))
let allowButton = NSButton(title: allowLabel, target: clicks, action: #selector(Clicks.allow))
allowButton.hasDestructiveAction = !warning.isEmpty
let buttons = NSStackView(views: [NSView(), denyButton, allowButton])
buttons.orientation = .horizontal

let content = NSStackView(views: [
  wrappingLabel(title, font: .boldSystemFont(ofSize: 13)), warningLabel, explanation, commandLabel, buttons,
])
content.orientation = .vertical
content.alignment = .leading
content.spacing = 8
content.edgeInsets = NSEdgeInsets(top: padding, left: padding, bottom: padding, right: padding)
content.widthAnchor.constraint(equalToConstant: width).isActive = true
buttons.widthAnchor.constraint(equalToConstant: width - 2 * padding).isActive = true

let panel = NSPanel(
  contentRect: NSRect(x: 0, y: 0, width: width, height: 100),
  styleMask: [.titled, .nonactivatingPanel, .utilityWindow],
  backing: .buffered, defer: false)
panel.title = "Voice Orchestrator"
panel.contentView = content
panel.level = .floating
panel.isFloatingPanel = true
panel.hidesOnDeactivate = false  // this app is never active, so it would never show
panel.becomesKeyOnlyIfNeeded = true
panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

/** Fits the panel to its text, in the top-right corner of the screen. */
func placeInCorner() {
  content.layoutSubtreeIfNeeded()
  let size = panel.frameRect(forContentRect: NSRect(origin: .zero, size: content.fittingSize)).size
  let screen = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
  let origin = NSPoint(x: screen.maxX - size.width - screenMargin, y: screen.maxY - size.height - screenMargin)
  panel.setFrame(NSRect(origin: origin, size: size), display: true)
}

FileHandle.standardInput.readabilityHandler = { input in
  let chunk = input.availableData
  if chunk.isEmpty { exit(0) }
  let lines = String(decoding: chunk, as: UTF8.self).split(separator: "\n")
  guard let latest = lines.last else { return }
  DispatchQueue.main.async {
    explanation.stringValue = String(latest)
    explanation.isHidden = false
    placeInCorner()
  }
}

placeInCorner()
panel.orderFrontRegardless()
app.run()
