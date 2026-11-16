// The notice panel: one floating panel in the bottom-right corner showing the web UI's notice page (tasks that ended,
// their notes, and a box to reply to the worker). Showing it never activates the app or takes focus, and it can't become
// the key window until you click into it; then you can type there without bringing anything else forward.
// Commands on stdin, one per line: "load <url>" (once, first), "show", "hide"; stdin closing (the orchestrator quit)
// exits. The page reports its natural height and the panel fits it, up to most of the screen, until you resize it by
// hand; a button in the title bar then puts it back to that default size.
// The panel only ever shows pages from the URL's own origin; links open in the default browser.
// Usage: notice-panel
import AppKit
import WebKit

let width: CGFloat = 460
let minHeight: CGFloat = 160
let heightLimits = HeightLimits(min: minHeight, maxScreenShare: 0.7)
let screenMargin: CGFloat = 12
let messageName = "panel"

/**
 * Takes typing only after a click into it, never just by appearing, so a new notice doesn't pull the keyboard away from
 * the app you're typing in. Clicking elsewhere gives the keyboard back and the next notice waits for a click again.
 */
final class NoticePanel: NSPanel {
  private var clickedInto = false
  override var canBecomeKey: Bool { clickedInto }

  override func sendEvent(_ event: NSEvent) {
    if isClick(event) && !clickedInto {
      clickedInto = true
      makeKey()
    }
    super.sendEvent(event)
  }

  override func resignKey() {
    super.resignKey()
    clickedInto = false
  }

  private func isClick(_ event: NSEvent) -> Bool {
    event.type == .leftMouseDown || event.type == .rightMouseDown || event.type == .otherMouseDown
  }
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

/** Keeps the panel on the page's origin, sends links to the browser, and passes the page's height on for sizing. */
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
    sizing.fit(pageHeight: CGFloat(truncating: height))
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
webView.setValue(false, forKey: "drawsBackground")  // the page is see-through, so the panel's glass shows behind it

let panel = NoticePanel(
  contentRect: NSRect(x: 0, y: 0, width: width, height: minHeight),
  styleMask: [.titled, .nonactivatingPanel, .utilityWindow],
  backing: .buffered, defer: false)
panel.title = "Voice Orchestrator"
/** Holds the page below the see-through title bar, whose buttons would otherwise sit over the page's header. */
let pageHolder = NSView(frame: NSRect(x: 0, y: 0, width: width, height: minHeight))
pageHolder.addSubview(webView)
glaze(panel, around: pageHolder)
let sizing = PanelSizing(of: panel, width: width, heightLimits: heightLimits)
let titlebarInset = titlebarHeight(of: panel)
webView.frame = NSRect(x: 0, y: 0, width: width, height: pageHolder.bounds.height - titlebarInset)
panel.level = .floating
panel.isFloatingPanel = true
panel.hidesOnDeactivate = false  // this app is never active, so it would never show
panel.becomesKeyOnlyIfNeeded = false
panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

let pointerRelay = PointerRelay()
webView.addTrackingArea(
  NSTrackingArea(
    rect: .zero, options: [.activeAlways, .mouseMoved, .mouseEnteredAndExited, .inVisibleRect],
    owner: pointerRelay, userInfo: nil))

installEditMenu(in: app)

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
  webView.evaluateJavaScript("window.panelShown?.()")  // your spoken words go to its reply box while it's shown
}

func run(_ command: Substring) {
  if command.hasPrefix("load "), let url = URL(string: String(command.dropFirst("load ".count))) {
    pageGuard.origin = url
    webView.load(URLRequest(url: url))
  } else if command == "show" {
    show()
  } else if command == "hide" {
    panel.orderOut(nil)
    webView.evaluateJavaScript("window.panelHidden?.()")
  }
}

FileHandle.standardInput.readabilityHandler = { input in
  let chunk = input.availableData
  if chunk.isEmpty { exit(0) }
  let commands = String(decoding: chunk, as: UTF8.self).split(separator: "\n")
  DispatchQueue.main.async { commands.forEach(run) }
}

app.run()
