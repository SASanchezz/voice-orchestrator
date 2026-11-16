// A small floating panel with buttons in the top-right corner: a worker's permission request (Deny / Allow),
// the assistant's ask for a confirm phrase (Cancel / Confirm <verb>),
// or a worker's question (its options, stacked, and a field for your own answer).
// It never activates or takes focus: the app you're in (e.g. the browser) stays in front and keeps the keyboard,
// until you click into the answer field, which then takes typing without bringing anything else forward.
// Prints "seen" on your first click anywhere in it (so what is said about it can stop while you read), then the
// clicked button's answer ("deny" / "allow" by default), or "text:<your answer>", and exits.
// Each line on stdin replaces the plain-language explanation; stdin closing (the orchestrator quit) closes the panel.
// Usage: popup-panel <title> <warning or ""> <detail or ""> <allow label>
//          [--button <answer> <label>]... [--stacked] [--text <placeholder>] [--explanation <text>]
//          [--whole-detail <text>]
// Buttons given with --button replace Deny and Allow, left to right, or top to bottom with --stacked.
// --explanation shows plain-language text from the start, in the place stdin's explanations go.
// --whole-detail is the detail uncut: a "Show whole command" link swaps the short detail for it, scrolling when long.
import AppKit

let usageExitCode: Int32 = 64
let width: CGFloat = 420
let padding: CGFloat = 16
let screenMargin: CGFloat = 12
/** Between the see-through title bar and the title, which sits under it instead of below a solid bar. */
let titlebarGap: CGFloat = 4
let positionalCount = 4
/** How tall the whole command grows before it scrolls. */
let wholeDetailMaxHeight: CGFloat = 320
let showWholeTitle = "▸ Show whole command"
let showShortTitle = "▾ Show less"

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
let firstExplanation = option("--explanation") ?? ""
let wholeDetail = option("--whole-detail") ?? ""

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

  /** Swaps the short detail for the whole one, or back, and refits the panel. */
  @objc func toggledWholeDetail(_ toggle: NSButton) {
    let showingWhole = wholeDetailView.isHidden
    wholeDetailView.isHidden = !showingWhole
    commandLabel.isHidden = showingWhole
    toggle.title = showingWhole ? showShortTitle : showWholeTitle
    placeInCorner()
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

let explanation = wrappingLabel(firstExplanation, font: .systemFont(ofSize: 13))
explanation.isHidden = firstExplanation.isEmpty
let warningLabel = wrappingLabel(warning, font: .boldSystemFont(ofSize: 12), color: .systemRed)
warningLabel.isHidden = warning.isEmpty
let commandLabel = wrappingLabel(command, font: .monospacedSystemFont(ofSize: 11, weight: .regular), color: .secondaryLabelColor)
commandLabel.isHidden = command.isEmpty

/** Selectable monospaced text, as tall as it needs up to `wholeDetailMaxHeight`, then scrolling. */
func scrollingDetail(_ text: String) -> NSScrollView {
  let scroll = NSTextView.scrollableTextView()
  scroll.drawsBackground = false
  guard let textView = scroll.documentView as? NSTextView else { return scroll }
  textView.string = text
  textView.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
  textView.textColor = .secondaryLabelColor
  textView.drawsBackground = false
  textView.isEditable = false
  textView.textContainer?.lineFragmentPadding = 0
  let textWidth = width - 2 * padding
  textView.frame.size.width = textWidth
  scroll.widthAnchor.constraint(equalToConstant: textWidth).isActive = true
  scroll.heightAnchor.constraint(equalToConstant: min(textHeight(of: textView), wholeDetailMaxHeight)).isActive = true
  return scroll
}
func textHeight(of textView: NSTextView) -> CGFloat {
  guard let layout = textView.layoutManager, let container = textView.textContainer else { return 0 }
  layout.ensureLayout(for: container)
  return layout.usedRect(for: container).height + 2 * textView.textContainerInset.height
}
let wholeDetailView = scrollingDetail(wholeDetail)
wholeDetailView.isHidden = true
let wholeDetailToggle = NSButton(title: showWholeTitle, target: clicks, action: #selector(Clicks.toggledWholeDetail(_:)))
wholeDetailToggle.isBordered = false
wholeDetailToggle.font = .systemFont(ofSize: 11)
wholeDetailToggle.contentTintColor = .linkColor
wholeDetailToggle.isHidden = wholeDetail.isEmpty

func approves(_ answer: String) -> Bool {
  answer == "allow" || answer.hasPrefix("confirm:")
}

/** A question's options numbered; Allow and Confirm green, or red under a warning; Deny and Cancel clear. */
func look(for answer: String, at index: Int) -> ButtonLook {
  if stacked { return optionLook(number: index + 1) }
  if !approves(answer) { return dismissLook }
  return warning.isEmpty ? allowLook : destructiveLook
}

let answerButtons = buttonOptions().enumerated().map { index, option -> NSButton in
  let button = NSButton(title: option.label, target: clicks, action: #selector(Clicks.clicked(_:)))
  button.identifier = NSUserInterfaceItemIdentifier(option.answer)
  button.hasDestructiveAction = approves(option.answer) && !warning.isEmpty
  dress(button, as: look(for: option.answer, at: index))
  return button
}
let buttons = NSStackView(views: stacked ? answerButtons : [NSView()] + answerButtons)
buttons.orientation = stacked ? .vertical : .horizontal
buttons.alignment = stacked ? .leading : .centerY
if stacked {
  answerButtons.forEach { $0.widthAnchor.constraint(equalTo: buttons.widthAnchor).isActive = true }
}

let ownAnswer = NSTextField(string: "")
ownAnswer.placeholderString = ownAnswerPlaceholder
ownAnswer.cell?.sendsActionOnEndEditing = false
ownAnswer.target = clicks
ownAnswer.action = #selector(Clicks.sent(_:))
let sendButton = NSButton(title: "Send", target: clicks, action: #selector(Clicks.sent(_:)))
dress(sendButton, as: sendLook)
ownAnswer.controlSize = .large
let ownAnswerRow = NSStackView(views: [ownAnswer, sendButton])
ownAnswerRow.orientation = .horizontal
ownAnswerRow.isHidden = ownAnswerPlaceholder == nil

let content = NSStackView(views: [
  wrappingLabel(title, font: .boldSystemFont(ofSize: 13)), warningLabel, explanation, commandLabel, wholeDetailView,
  wholeDetailToggle, buttons, ownAnswerRow,
])
content.orientation = .vertical
content.alignment = .leading
content.spacing = 8
content.edgeInsets = NSEdgeInsets(top: padding, left: padding, bottom: padding, right: padding)
content.widthAnchor.constraint(greaterThanOrEqualToConstant: width).isActive = true
buttons.widthAnchor.constraint(equalTo: content.widthAnchor, constant: -2 * padding).isActive = true
ownAnswerRow.widthAnchor.constraint(equalTo: content.widthAnchor, constant: -2 * padding).isActive = true

/** Says "seen" once, on your first click anywhere in it, buttons included, before any answer. */
final class SeenPanel: NSPanel {
  private var seen = false

  override func sendEvent(_ event: NSEvent) {
    if event.type == .leftMouseDown && !seen {
      seen = true
      print("seen")
      fflush(stdout)
    }
    super.sendEvent(event)
  }
}

let panel = SeenPanel(
  contentRect: NSRect(x: 0, y: 0, width: width, height: 100),
  styleMask: [.titled, .nonactivatingPanel, .utilityWindow],
  backing: .buffered, defer: false)
panel.title = "Voice Orchestrator"
glaze(panel, around: content)
content.edgeInsets.top = titlebarHeight(of: panel) + titlebarGap
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
