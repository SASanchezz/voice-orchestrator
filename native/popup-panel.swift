// A small floating panel with buttons in the top-right corner: a worker's permission request (Deny / Allow),
// or a worker's question (its options, stacked, and a field for your own answer).
// It never activates or takes focus: the app you're in (e.g. the browser) stays in front and keeps the keyboard,
// until you click into the answer field, which then takes typing without bringing anything else forward.
// Prints the clicked button's answer ("deny" / "allow" by default), or "text:<your answer>", and exits.
// Each line on stdin replaces the plain-language explanation; stdin closing (the orchestrator quit) closes the panel.
// Usage: popup-panel <title> <warning or ""> <detail or ""> <allow label>
//          [--button <answer> <label>]... [--stacked] [--text <placeholder>]
// Buttons given with --button replace Deny and Allow, left to right, or top to bottom with --stacked.
import AppKit

let usageExitCode: Int32 = 64
let width: CGFloat = 420
let padding: CGFloat = 16
let screenMargin: CGFloat = 12
let positionalCount = 4

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count >= positionalCount else {
  FileHandle.standardError.write("usage: popup-panel <title> <warning> <detail> <allow label> [options]\n".data(using: .utf8)!)
  exit(usageExitCode)
}
let (title, warning, command, allowLabel) = (arguments[0], arguments[1], arguments[2], arguments[3])
let options = Array(arguments.dropFirst(positionalCount))

/** The value after `flag`, if it was given. */
func option(_ flag: String) -> String? {
  guard let index = options.firstIndex(of: flag), index + 1 < options.count else { return nil }
  return options[index + 1]
}
/** The values after each `flag` that has `count` of them, in order. */
func repeatedOption(_ flag: String, count: Int) -> [[String]] {
  var found: [[String]] = []
  var index = 0
  while index < options.count {
    if options[index] == flag, index + count < options.count {
      found.append(Array(options[(index + 1)...(index + count)]))
      index += count + 1
    } else {
      index += 1
    }
  }
  return found
}
/** Every "--button <answer> <label>", in order; without any, Deny and the allow label. */
func buttonOptions() -> [(answer: String, label: String)] {
  let buttons = repeatedOption("--button", count: 2).map { (answer: $0[0], label: $0[1]) }
  return buttons.isEmpty ? [(answer: "deny", label: "Deny"), (answer: "allow", label: allowLabel)] : buttons
}
let stacked = options.contains("--stacked")
let ownAnswerPlaceholder = option("--text")

final class Clicks: NSObject {
  /** Each button carries its answer as its identifier. */
  @objc func clicked(_ button: NSButton) {
    print(button.identifier?.rawValue ?? "")
    fflush(stdout)
    exit(0)
  }

  /** Return in the answer field, or its Send button; an empty answer sends nothing. */
  @objc func sent(_ sender: Any) {
    let answer = ownAnswer.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !answer.isEmpty else { return }
    print("text:" + answer)
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
// never becomes the active app, so it never takes focus; an answer field needs the panel to be able to take typing
app.setActivationPolicy(ownAnswerPlaceholder == nil ? .prohibited : .accessory)
let clicks = Clicks()

let explanation = wrappingLabel("", font: .systemFont(ofSize: 13))
explanation.isHidden = true
let warningLabel = wrappingLabel(warning, font: .boldSystemFont(ofSize: 12), color: .systemRed)
warningLabel.isHidden = warning.isEmpty
let commandLabel = wrappingLabel(command, font: .monospacedSystemFont(ofSize: 11, weight: .regular), color: .secondaryLabelColor)
commandLabel.isHidden = command.isEmpty

let answerButtons = buttonOptions().map { option -> NSButton in
  let button = NSButton(title: option.label, target: clicks, action: #selector(Clicks.clicked(_:)))
  button.identifier = NSUserInterfaceItemIdentifier(option.answer)
  button.hasDestructiveAction = option.answer == "allow" && !warning.isEmpty
  return button
}
let buttons = NSStackView(views: stacked ? answerButtons : [NSView()] + answerButtons)
buttons.orientation = stacked ? .vertical : .horizontal
buttons.alignment = stacked ? .leading : .centerY

let ownAnswer = NSTextField(string: "")
ownAnswer.placeholderString = ownAnswerPlaceholder
ownAnswer.cell?.sendsActionOnEndEditing = false
ownAnswer.target = clicks
ownAnswer.action = #selector(Clicks.sent(_:))
let ownAnswerRow = NSStackView(views: [ownAnswer, NSButton(title: "Send", target: clicks, action: #selector(Clicks.sent(_:)))])
ownAnswerRow.orientation = .horizontal
ownAnswerRow.isHidden = ownAnswerPlaceholder == nil

let content = NSStackView(views: [
  wrappingLabel(title, font: .boldSystemFont(ofSize: 13)), warningLabel, explanation, commandLabel, buttons, ownAnswerRow,
])
content.orientation = .vertical
content.alignment = .leading
content.spacing = 8
content.edgeInsets = NSEdgeInsets(top: padding, left: padding, bottom: padding, right: padding)
content.widthAnchor.constraint(greaterThanOrEqualToConstant: width).isActive = true
buttons.widthAnchor.constraint(equalTo: content.widthAnchor, constant: -2 * padding).isActive = true
ownAnswerRow.widthAnchor.constraint(equalTo: content.widthAnchor, constant: -2 * padding).isActive = true

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
