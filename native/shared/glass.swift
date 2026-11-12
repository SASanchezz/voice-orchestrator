// The look shared by the floating panels: frosted glass behind the whole panel, and buttons that say what they do by
// colour and symbol, as in the web UI (Allow green ✓, Deny and Cancel clear ✕, a question's options numbered).
// Frosted material held in its active look rather than Liquid Glass, which turns lighter or darker the moment you click
// into the panel and it becomes the key window.
// Compiled together with each panel's own source (see src/macos/native-helper.ts).
import AppKit

let glassCornerRadius: CGFloat = 18
/** Dark enough that light text and the coloured buttons stand out over a bright window behind the panel. */
let glassVeil = NSColor(calibratedWhite: 0.07, alpha: 0.62)

/** Glass behind all of `panel`, its title bar see-through with the content running under it. */
func glaze(_ panel: NSPanel, around content: NSView) {
  panel.styleMask.insert(.fullSizeContentView)
  panel.titlebarAppearsTransparent = true
  panel.titleVisibility = .hidden
  panel.isMovableByWindowBackground = true
  panel.isOpaque = false
  panel.backgroundColor = .clear
  panel.appearance = NSAppearance(named: .darkAqua)
  panel.contentView = glassView(around: content)
}

/** How far the see-through title bar reaches down over the content, so the content can keep clear of it. */
func titlebarHeight(of panel: NSPanel) -> CGFloat {
  panel.frame.height - panel.contentLayoutRect.height
}

/** The same whether or not the panel is the key window, so clicking into it doesn't change how it looks. */
func glassView(around content: NSView) -> NSView {
  let frost = NSVisualEffectView()
  frost.material = .hudWindow
  frost.blendingMode = .behindWindow
  frost.state = .active
  frost.wantsLayer = true
  frost.layer?.cornerRadius = glassCornerRadius
  frost.layer?.masksToBounds = true
  content.frame = frost.bounds
  content.autoresizingMask = [.width, .height]
  frost.addSubview(content)
  veil(content)
  return frost
}

/** The frost alone lets too much of the window behind show through for the buttons to stand out. */
func veil(_ content: NSView) {
  content.wantsLayer = true
  content.layer?.backgroundColor = glassVeil.cgColor
  content.layer?.cornerRadius = glassCornerRadius
}

/** A button's symbol and colour, and how strongly the colour fills it: faintly for clear glass, more when tinted. */
struct ButtonLook {
  let symbol: String
  let tint: NSColor
  let fillAlpha: CGFloat
}

let clearFill: CGFloat = 0.2
let tintedFill: CGFloat = 0.72
let allowLook = ButtonLook(symbol: "checkmark", tint: .systemGreen, fillAlpha: tintedFill)
let destructiveLook = ButtonLook(symbol: "exclamationmark.triangle.fill", tint: .systemRed, fillAlpha: tintedFill)
let dismissLook = ButtonLook(symbol: "xmark", tint: .white, fillAlpha: clearFill)
let sendLook = ButtonLook(symbol: "paperplane.fill", tint: .systemOrange, fillAlpha: tintedFill)

/** "1.circle", "2.circle", … for a question's options, in order. */
func optionLook(number: Int) -> ButtonLook {
  ButtonLook(symbol: "\(number).circle", tint: .white, fillAlpha: clearFill)
}

let pillHeight: CGFloat = 30
let pillPadding: CGFloat = 28
let pillEdgeAlpha: CGFloat = 0.9
/** The words and symbol: the tint lightened almost to white, so they read on a strongly coloured pill. */
let pillTextLightening: CGFloat = 0.85

/**
 * A pill of tinted glass, drawn by hand: AppKit greys out its own buttons in a window that isn't active,
 * and these panels never are, so system buttons would lose their colour.
 */
func dress(_ button: NSButton, as look: ButtonLook) {
  let textColor = look.tint.blended(withFraction: pillTextLightening, of: .white) ?? look.tint
  button.isBordered = false
  button.wantsLayer = true
  button.layer?.cornerRadius = pillHeight / 2
  button.layer?.backgroundColor = look.tint.withAlphaComponent(look.fillAlpha).cgColor
  button.layer?.borderWidth = 1
  button.layer?.borderColor = look.tint.withAlphaComponent(pillEdgeAlpha).cgColor
  button.image = symbol(look.symbol, in: textColor)
  button.imagePosition = .imageLeading
  button.imageHugsTitle = true
  button.attributedTitle = pillTitle(" " + button.title, in: textColor)
  button.heightAnchor.constraint(equalToConstant: pillHeight).isActive = true
  let roomy = button.widthAnchor.constraint(greaterThanOrEqualToConstant: button.intrinsicContentSize.width + pillPadding)
  roomy.isActive = true
}

/** In its own colour rather than as a template, which a window that isn't active would grey out. */
func symbol(_ name: String, in color: NSColor) -> NSImage? {
  let colored = NSImage.SymbolConfiguration(paletteColors: [color])
  let sized = NSImage.SymbolConfiguration(pointSize: 13, weight: .semibold)
  return NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(sized.applying(colored))
}

func pillTitle(_ title: String, in color: NSColor) -> NSAttributedString {
  let font = NSFont.systemFont(ofSize: 13, weight: .semibold)
  return NSAttributedString(string: title, attributes: [.foregroundColor: color, .font: font])
}
