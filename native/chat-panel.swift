// The assistant's chat as a floating panel: your recent dialogue as bubbles, scrollable, Deny and Approve while the
// assistant waits for an answer, and a field to write to it. It stays open until you close it (its Close button, or
// Esc while typing); the orchestrator brings it to the front again with each finished reply instead of opening another.
// It sits in the top-right corner and looks like the permission and question pop-ups. Showing it never activates the
// app or takes focus; a click into the field does. It grows with the dialogue up to a height, then scrolls, following
// new messages only while you're at the bottom, so reading back isn't interrupted.
// Commands on stdin, one JSON object per line:
//   {"command":"dialogue","title":"…","offersApproval":true,"lines":[{"role":"user"|"orchestrator","text":"…"}]}
//   replaces what it shows; {"command":"show"} brings it to the front, scrolled to the latest. stdin closing exits.
// Prints "cancel", "yes" or "text:<your words>" on a line of its own for each click or message, and exits once closed.
// It also prints "seen" on your first click anywhere in it since it last came to the front, so the reply being said
// can stop while you read.
// Usage: chat-panel
import AppKit

let width: CGFloat = 420
let padding: CGFloat = 16
let minDialogueHeight: CGFloat = 60
let maxDialogueHeight: CGFloat = 420
/** How close to the end still counts as reading the latest message. */
let followSlack: CGFloat = 24
let screenMargin: CGFloat = 12
/** Between the see-through title bar and the title, which sits under it instead of below a solid bar. */
let titlebarGap: CGFloat = 4
let newline = UInt8(ascii: "\n")
let dialogueWidth = width - 2 * padding

struct Command: Decodable {
  let command: String
  let title: String?
  let offersApproval: Bool?
  let lines: [ChatLine]?
}

/** Esc closes it, as it does a sheet or a popover. Says "seen" on the first click since it last came to the front. */
final class ChatWindow: NSPanel {
  private var seen = false

  override func cancelOperation(_ sender: Any?) { close() }

  override func sendEvent(_ event: NSEvent) {
    if event.type == .leftMouseDown && !seen {
      seen = true
      print("seen")
      fflush(stdout)
    }
    super.sendEvent(event)
  }

  /** Brought up again with a new reply, so the next click silences that one. */
  func cameToFront() {
    seen = false
  }
}

final class Answers: NSObject, NSWindowDelegate {
  /** Each button carries its answer as its identifier. */
  @objc func clicked(_ button: NSButton) {
    send(button.identifier?.rawValue ?? "")
  }

  /** Return in the field, or its Send button; an empty message sends nothing. */
  @objc func sent(_ sender: Any) {
    let words = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !words.isEmpty else { return }
    field.stringValue = ""
    send("text:" + words)
  }

  func windowWillClose(_ notification: Notification) {
    exit(0)
  }

  private func send(_ answer: String) {
    print(answer)
    fflush(stdout)
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // never in the Dock; still takes typing once you click into the field
installEditMenu(in: app)
let answers = Answers()

let titleLabel = NSTextField(labelWithString: "")
titleLabel.font = .boldSystemFont(ofSize: 13)
let closeButton = NSButton(title: "Close", target: nil, action: #selector(NSWindow.close))
dress(closeButton, as: dismissLook)
let titleRow = NSStackView(views: [titleLabel, NSView(), closeButton])

let messages = TopDownStack()
messages.orientation = .vertical
messages.alignment = .leading
messages.spacing = messageSpacing
let dialogueScroll = NSScrollView()
dialogueScroll.drawsBackground = false
dialogueScroll.hasVerticalScroller = true
dialogueScroll.autohidesScrollers = true
dialogueScroll.documentView = messages
messages.translatesAutoresizingMaskIntoConstraints = false
messages.widthAnchor.constraint(equalToConstant: dialogueWidth).isActive = true
dialogueScroll.widthAnchor.constraint(equalToConstant: dialogueWidth).isActive = true
let dialogueHeight = dialogueScroll.heightAnchor.constraint(equalToConstant: minDialogueHeight)
dialogueHeight.isActive = true

func answerButton(_ label: String, answer: String, look: ButtonLook) -> NSButton {
  let button = NSButton(title: label, target: answers, action: #selector(Answers.clicked(_:)))
  button.identifier = NSUserInterfaceItemIdentifier(answer)
  dress(button, as: look)
  return button
}
let buttons = NSStackView(views: [
  NSView(), answerButton("Deny", answer: "cancel", look: dismissLook), answerButton("Approve", answer: "yes", look: allowLook),
])

let field = NSTextField(string: "")
field.placeholderString = "Reply to the assistant…"
field.controlSize = .large
field.cell?.sendsActionOnEndEditing = false
field.target = answers
field.action = #selector(Answers.sent(_:))
let sendButton = NSButton(title: "Send", target: answers, action: #selector(Answers.sent(_:)))
dress(sendButton, as: sendLook)
let fieldRow = NSStackView(views: [field, sendButton])

let content = NSStackView(views: [titleRow, dialogueScroll, buttons, fieldRow])
content.orientation = .vertical
content.alignment = .leading
content.spacing = 10
content.edgeInsets = NSEdgeInsets(top: padding, left: padding, bottom: padding, right: padding)
content.widthAnchor.constraint(equalToConstant: width).isActive = true
[titleRow, buttons, fieldRow].forEach { $0.widthAnchor.constraint(equalToConstant: dialogueWidth).isActive = true }

let panel = ChatWindow(
  contentRect: NSRect(x: 0, y: 0, width: width, height: maxDialogueHeight),
  styleMask: [.titled, .closable, .nonactivatingPanel, .utilityWindow],
  backing: .buffered, defer: false)
panel.title = "Voice Orchestrator"
panel.delegate = answers
glaze(panel, around: content)
[.closeButton, .miniaturizeButton, .zoomButton].forEach { panel.standardWindowButton($0)?.isHidden = true }
closeButton.target = panel
content.edgeInsets.top = titlebarHeight(of: panel) + titlebarGap
panel.level = .floating
panel.isFloatingPanel = true
panel.hidesOnDeactivate = false  // this app is never active, so it would never show
panel.becomesKeyOnlyIfNeeded = true
panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

/** Fits the panel to its content; it keeps its top edge, or goes to the top-right corner of the screen. */
func fit() {
  content.layoutSubtreeIfNeeded()
  let size = panel.frameRect(forContentRect: NSRect(origin: .zero, size: content.fittingSize)).size
  let screen = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
  let cornerX = screen.maxX - screenMargin - size.width
  let x = panel.isVisible ? panel.frame.minX : cornerX
  let top = panel.isVisible ? panel.frame.maxY : screen.maxY - screenMargin
  panel.setFrame(NSRect(x: x, y: top - size.height, width: size.width, height: size.height), display: true)
}

func isReadingLatest() -> Bool {
  let visible = dialogueScroll.contentView.bounds
  return visible.maxY >= messages.frame.height - followSlack
}

func scrollToLatest() {
  messages.layoutSubtreeIfNeeded()
  let end = max(0, messages.frame.height - dialogueScroll.contentView.bounds.height)
  dialogueScroll.contentView.scroll(to: NSPoint(x: 0, y: end))
  dialogueScroll.reflectScrolledClipView(dialogueScroll.contentView)
}

func show() {
  fit()
  scrollToLatest()
  panel.cameToFront()
  panel.orderFrontRegardless()
}

/** The new dialogue, as tall as it needs up to the limit. */
func showDialogue(title: String, offersApproval: Bool, lines: [ChatLine]) {
  let follows = isReadingLatest()
  titleLabel.stringValue = title
  buttons.isHidden = !offersApproval
  messages.arrangedSubviews.forEach { $0.removeFromSuperview() }
  lines.forEach { messages.addArrangedSubview(messageRow($0, width: dialogueWidth)) }
  messages.layoutSubtreeIfNeeded()
  dialogueHeight.constant = min(max(messages.fittingSize.height, minDialogueHeight), maxDialogueHeight)
  fit()
  if follows { scrollToLatest() }
}

func run(_ line: Data) {
  guard let command = try? JSONDecoder().decode(Command.self, from: line) else { return }
  if command.command == "dialogue" {
    showDialogue(title: command.title ?? "", offersApproval: command.offersApproval ?? false, lines: command.lines ?? [])
  }
  if command.command == "show" { show() }
}

/** stdin arrives in chunks that may end mid-line; whole lines are run, the rest waits for the next chunk. */
var unread = Data()
func receive(_ chunk: Data) {
  unread.append(chunk)
  while let end = unread.firstIndex(of: newline) {
    let line = unread[unread.startIndex..<end]
    unread = Data(unread[unread.index(after: end)...])
    run(Data(line))
  }
}

FileHandle.standardInput.readabilityHandler = { input in
  let chunk = input.availableData
  if chunk.isEmpty { exit(0) }
  DispatchQueue.main.async { receive(chunk) }
}

app.run()
