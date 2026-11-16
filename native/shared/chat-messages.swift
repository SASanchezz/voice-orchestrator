// The chat panel's messages as bubbles, like the web UI's chat: yours in violet on the right, the assistant's on clear
// glass on the left, each as wide as its words up to most of the panel. Markdown's bold, italics, code and links show
// as such; the text is selectable, and links open in the browser.
// Compiled together with chat-panel.swift (see src/macos/native-helper.ts).
import AppKit

struct ChatLine: Decodable {
  let role: String
  let text: String
}

let bubbleMaxShare: CGFloat = 0.82
let bubbleCornerRadius: CGFloat = 14
let bubbleInsets = NSEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
let messageSpacing: CGFloat = 8
/** The web UI's violet for your messages. */
let yourBubbleColor = NSColor(srgbRed: 0.49, green: 0.30, blue: 0.93, alpha: 1)
let assistantBubbleColor = NSColor(calibratedWhite: 1, alpha: 0.07)
let assistantBubbleEdge = NSColor(calibratedWhite: 1, alpha: 0.14)
let bodyFont = NSFont.systemFont(ofSize: 13)
let codeFont = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)

/** Top to bottom from the start of the scroll view, as a chat reads, instead of AppKit's bottom-up. */
final class TopDownStack: NSStackView {
  override var isFlipped: Bool { true }
}

/** One row per message, its bubble pushed right for yours and left for the assistant's. */
func messageRow(_ line: ChatLine, width: CGFloat) -> NSView {
  let isYours = line.role == "user"
  let bubble = bubbleView(line.text, isYours: isYours, maxWidth: width * bubbleMaxShare)
  let row = NSStackView(views: isYours ? [NSView(), bubble] : [bubble, NSView()])
  row.orientation = .horizontal
  row.widthAnchor.constraint(equalToConstant: width).isActive = true
  return row
}

func bubbleView(_ text: String, isYours: Bool, maxWidth: CGFloat) -> NSView {
  let label = NSTextField(wrappingLabelWithString: "")
  label.attributedStringValue = formatted(text)
  label.isSelectable = true
  label.allowsEditingTextAttributes = true  // makes links clickable
  label.preferredMaxLayoutWidth = maxWidth - bubbleInsets.left - bubbleInsets.right
  let bubble = NSStackView(views: [label])
  bubble.edgeInsets = bubbleInsets
  bubble.wantsLayer = true
  bubble.layer?.cornerRadius = bubbleCornerRadius
  bubble.layer?.backgroundColor = (isYours ? yourBubbleColor : assistantBubbleColor).cgColor
  bubble.layer?.borderWidth = isYours ? 0 : 1
  bubble.layer?.borderColor = assistantBubbleEdge.cgColor
  bubble.widthAnchor.constraint(lessThanOrEqualToConstant: maxWidth).isActive = true
  return bubble
}

/** The message's markdown (inline only, line breaks kept) in the panel's fonts, white on the dark glass. */
func formatted(_ text: String) -> NSAttributedString {
  let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
  let parsed =
    (try? NSMutableAttributedString(markdown: text, options: options, baseURL: nil))
    ?? NSMutableAttributedString(string: text)
  let whole = NSRange(location: 0, length: parsed.length)
  parsed.addAttributes([.font: bodyFont, .foregroundColor: NSColor.white], range: whole)
  parsed.enumerateAttribute(.inlinePresentationIntent, in: whole) { value, range, _ in
    guard let raw = (value as? NSNumber)?.uintValue else { return }
    parsed.addAttribute(.font, value: font(for: InlinePresentationIntent(rawValue: raw)), range: range)
  }
  return parsed
}

func font(for intent: InlinePresentationIntent) -> NSFont {
  if intent.contains(.code) { return codeFont }
  var traits: NSFontTraitMask = []
  if intent.contains(.stronglyEmphasized) { traits.insert(.boldFontMask) }
  if intent.contains(.emphasized) { traits.insert(.italicFontMask) }
  return NSFontManager.shared.convert(bodyFont, toHaveTrait: traits)
}
