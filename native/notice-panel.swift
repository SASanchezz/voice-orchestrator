// The notice panel: one floating panel in the bottom-right corner showing the web UI's notice page (tasks that ended,
// their notes, and a box to reply to the worker). Showing it never activates the app or takes focus; a click into it
// makes it the key window, so you can type, without bringing anything else forward.
// It is left out of screen sharing and recordings, since it shows the workers' notes.
// Commands on stdin, one per line: "load <url>" (once, first), "show", "hide"; stdin closing (the orchestrator quit)
// exits. The page reports its natural height and the panel fits it, up to most of the screen.
// The panel only ever shows pages from the URL's own origin; links open in the default browser.
// Usage: notice-panel
import AppKit
import WebKit

let width: CGFloat = 460
let minHeight: CGFloat = 160
let maxScreenShare: CGFloat = 0.7
let screenMargin: CGFloat = 12
let messageName = "panel"

/** Takes typing once clicked, though it never activates the app. */
final class NoticePanel: NSPanel {
  override var canBecomeKey: Bool { true }
}

/** The first click on the unfocused panel reaches the page instead of only focusing the panel. */
final class NoticeWebView: WKWebView {
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/** The pointer's place in the page, passed on while the panel isn't focused (WebKit only follows it in the key window). */
final class PointerRelay: NSResponder {
  override func mouseMoved(with event: NSEvent) { tell(event) }
  override func mouseEntered(with event: NSEvent) { tell(event) }
  override func mouseExited(with event: NSEvent) { webView.evaluateJavaScript("window.panelPointer?.()") }

  private func tell(_ event: NSEvent) {
    let point = webView.convert(event.locationInWindow, from: nil)
    let y = webView.isFlipped ? point.y : webView.bounds.height - point.y
    webView.evaluateJavaScript("window.panelPointer?.(\(Int(point.x)), \(Int(y)))")
  }
}

/** Keeps the panel on the page's origin, sends links to the browser, and fits the panel to the page's height. */
final class PageGuard: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
  var origin: URL?

  func webView(
    _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = action.request.url, !isOwn(url) else { return decisionHandler(.allow) }
    NSWorkspace.shared.open(url)
    decisionHandler(.cancel)
  }

  /** A link meant for a new window ("target=_blank") opens in the browser instead. */
  func webView(
    _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
    for action: WKNavigationAction, windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = action.request.url { NSWorkspace.shared.open(url) }
    return nil
  }

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any], let height = body["height"] as? NSNumber else { return }
    fit(height: CGFloat(truncating: height))
  }

  private func isOwn(_ url: URL) -> Bool {
    guard let origin else { return false }
    return url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // never in the Dock; still takes typing once you click the panel
let pageGuard = PageGuard()

let configuration = WKWebViewConfiguration()
configuration.userContentController.add(pageGuard, name: messageName)
let webView = NoticeWebView(frame: NSRect(x: 0, y: 0, width: width, height: minHeight), configuration: configuration)
webView.navigationDelegate = pageGuard
webView.uiDelegate = pageGuard
webView.autoresizingMask = [.width, .height]

let panel = NoticePanel(
  contentRect: NSRect(x: 0, y: 0, width: width, height: minHeight),
  styleMask: [.titled, .nonactivatingPanel, .utilityWindow],
  backing: .buffered, defer: false)
panel.title = "Voice Orchestrator"
panel.contentView = webView
panel.level = .floating
panel.isFloatingPanel = true
panel.hidesOnDeactivate = false  // this app is never active, so it would never show
panel.becomesKeyOnlyIfNeeded = false
panel.sharingType = .none
panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

let pointerRelay = PointerRelay()
webView.addTrackingArea(
  NSTrackingArea(
    rect: .zero, options: [.activeAlways, .mouseMoved, .mouseEnteredAndExited, .inVisibleRect],
    owner: pointerRelay, userInfo: nil))

/** Copy, paste and the rest work by their usual keys only through a menu, even one never shown. */
func editMenu() -> NSMenu {
  let menu = NSMenu(title: "Edit")
  menu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
  menu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
  menu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
  menu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
  menu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
  menu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
  return menu
}
let mainMenu = NSMenu()
let editItem = NSMenuItem()
editItem.submenu = editMenu()
mainMenu.addItem(editItem)
app.mainMenu = mainMenu

/** Fits the panel to the page's height, keeping its bottom-right corner where it is. */
func fit(height: CGFloat) {
  let screen = (panel.screen ?? NSScreen.main ?? NSScreen.screens[0]).visibleFrame
  let contentHeight = min(max(height, minHeight), screen.height * maxScreenShare)
  let size = panel.frameRect(forContentRect: NSRect(x: 0, y: 0, width: width, height: contentHeight)).size
  guard abs(size.height - panel.frame.height) >= 1 else { return }
  let frame = panel.frame
  panel.setFrame(NSRect(x: frame.maxX - size.width, y: frame.minY, width: size.width, height: size.height), display: true)
}

/** In the bottom-right corner of the screen. */
func placeInCorner() {
  let screen = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
  let size = panel.frame.size
  panel.setFrameOrigin(NSPoint(x: screen.maxX - size.width - screenMargin, y: screen.minY + screenMargin))
}

/** Shown where you last left it; only a panel that was hidden goes back to the corner. */
func show() {
  if !panel.isVisible { placeInCorner() }
  panel.orderFrontRegardless()
}

func run(_ command: Substring) {
  if command.hasPrefix("load "), let url = URL(string: String(command.dropFirst("load ".count))) {
    pageGuard.origin = url
    webView.load(URLRequest(url: url))
  } else if command == "show" {
    show()
  } else if command == "hide" {
    panel.orderOut(nil)
  }
}

FileHandle.standardInput.readabilityHandler = { input in
  let chunk = input.availableData
  if chunk.isEmpty { exit(0) }
  let commands = String(decoding: chunk, as: UTF8.self).split(separator: "\n")
  DispatchQueue.main.async { commands.forEach(run) }
}

app.run()
