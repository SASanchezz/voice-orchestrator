// A panel that fits its page's height until you resize it by hand, then keeps your size. A button in the title bar,
// shown only while the panel has your size, puts it back to the default width and the page's height.
import AppKit

let defaultSizeSymbol = "arrow.down.right.and.arrow.up.left"
let defaultSizeButtonSize: CGFloat = 22
let minResizedWidth: CGFloat = 320

/** How tall the panel may get: never shorter than `min`, never taller than this share of the screen. */
struct HeightLimits {
  let min: CGFloat
  let maxScreenShare: CGFloat
}

final class PanelSizing: NSObject, NSWindowDelegate {
  private let panel: NSPanel
  private let width: CGFloat
  private let heightLimits: HeightLimits
  private var pageHeight: CGFloat = 0
  private var resizedByHand = false
  private let defaultSizeAccessory = NSTitlebarAccessoryViewController()

  init(of panel: NSPanel, width: CGFloat, heightLimits: HeightLimits) {
    self.panel = panel
    self.width = width
    self.heightLimits = heightLimits
    super.init()
    panel.styleMask.insert(.resizable)
    panel.contentMinSize = NSSize(width: minResizedWidth, height: heightLimits.min)
    panel.delegate = self
    addDefaultSizeButton()
  }

  /** Fits the panel to the page's height, keeping its bottom-right corner where it is, unless you've sized it yourself. */
  func fit(pageHeight height: CGFloat) {
    pageHeight = height
    guard !resizedByHand else { return }
    let size = panel.frameRect(forContentRect: NSRect(origin: .zero, size: fittedContentSize())).size
    guard abs(size.height - panel.frame.height) >= 1 || abs(size.width - panel.frame.width) >= 1 else { return }
    let frame = panel.frame
    panel.setFrame(NSRect(x: frame.maxX - size.width, y: frame.minY, width: size.width, height: size.height), display: true)
  }

  func windowWillStartLiveResize(_ notification: Notification) {
    resizedByHand = true
    defaultSizeAccessory.isHidden = false
  }

  @objc func restoreDefaultSize(_ sender: NSButton) {
    resizedByHand = false
    defaultSizeAccessory.isHidden = true
    fit(pageHeight: pageHeight)
  }

  private func fittedContentSize() -> NSSize {
    let screen = (panel.screen ?? NSScreen.main ?? NSScreen.screens[0]).visibleFrame
    let titlebarInset = titlebarHeight(of: panel)
    let height = min(max(pageHeight + titlebarInset, heightLimits.min), screen.height * heightLimits.maxScreenShare)
    return NSSize(width: width, height: height)
  }

  /** Drawn in its own colour, since a system button greys out in a panel that isn't the key window. */
  private func addDefaultSizeButton() {
    let button = NSButton(image: NSImage(), target: self, action: #selector(restoreDefaultSize(_:)))
    button.isBordered = false
    button.image = symbol(defaultSizeSymbol, in: .secondaryLabelColor)
    button.toolTip = "Default size"
    button.frame = NSRect(x: 0, y: 0, width: defaultSizeButtonSize, height: defaultSizeButtonSize)
    defaultSizeAccessory.view = button
    defaultSizeAccessory.layoutAttribute = .trailing
    defaultSizeAccessory.isHidden = true
    panel.addTitlebarAccessoryViewController(defaultSizeAccessory)
  }
}
