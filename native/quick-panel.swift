// The quick panel: a key combo pressed in any app brings up a small panel in the upper middle of the screen you're on,
// showing the web UI's quick page, where you write to a worker session or the assistant and send. It takes the keyboard
// at once without bringing anything else forward, and goes away on Esc, on sending, on clicking elsewhere, or on the
// combo again. Commands on stdin, one per line: "load <url>" (first), then "hotkey <combo>" (see
// native/shared/key-combo.swift); stdin closing (the orchestrator quit) exits.
// The page posts {"height": n} to fit the panel to it, and {"command": "hide"} to put it away.
// Usage: quick-panel
import AppKit
import WebKit

let width: CGFloat = 600
let minHeight: CGFloat = 96
let maxScreenShare: CGFloat = 0.6
/** The panel's top edge sits this share of the screen's height below the screen's top, as Spotlight's does. */
let topShare: CGFloat = 0.2

/** Takes the keyboard the moment it shows, without activating this app, so the app you were in stays in front. */
final class QuickPanel: NSPanel {
  override var canBecomeKey: Bool { true }

  /** A click elsewhere puts it away, as a launcher does; what you wrote stays for next time. */
  override func resignKey() {
    super.resignKey()
    hide()
  }
}

/** The first click reaches the page instead of only focusing the panel. */
final class QuickWebView: WKWebView {
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)  // never in the Dock
let pageGuard = PageGuard()

let configuration = WKWebViewConfiguration()
configuration.userContentController.add(pageGuard, name: pageMessageName)
let webView = QuickWebView(frame: NSRect(x: 0, y: 0, width: width, height: minHeight), configuration: configuration)
webView.navigationDelegate = pageGuard
webView.uiDelegate = pageGuard
webView.setValue(false, forKey: "drawsBackground")  // the page is see-through, so the panel's glass shows behind it

let panel = QuickPanel(
  contentRect: NSRect(x: 0, y: 0, width: width, height: minHeight),
  styleMask: [.borderless, .nonactivatingPanel],
  backing: .buffered, defer: false)
panel.title = "Quick message"
glaze(panel, around: webView)
panel.hasShadow = true
panel.level = .modalPanel  // above the notice and permission pop-ups while you write
panel.isFloatingPanel = true
panel.hidesOnDeactivate = false  // this app is never active, so it would never show
panel.becomesKeyOnlyIfNeeded = false
panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
installEditMenu(in: app)

/** Where the top edge stays while the page grows and shrinks. */
var topEdge: CGFloat = 0

pageGuard.onMessage = { body in
  if let height = body["height"] as? NSNumber { fit(pageHeight: CGFloat(truncating: height)) }
  if body["command"] as? String == "hide" { hide() }
}

func toggle() {
  if panel.isVisible && panel.isKeyWindow { hide() } else { show() }
}

/** On the screen the pointer is on, so it comes up where you're looking. */
func show() {
  placeOnPointerScreen()
  panel.orderFrontRegardless()
  panel.makeKey()
  panel.makeFirstResponder(webView)
  webView.evaluateJavaScript("window.panelShown?.()")
}

func hide() {
  guard panel.isVisible else { return }
  panel.orderOut(nil)
  webView.evaluateJavaScript("window.panelHidden?.()")
}

func placeOnPointerScreen() {
  let pointer = NSEvent.mouseLocation
  let screen = NSScreen.screens.first { NSMouseInRect(pointer, $0.frame, false) } ?? NSScreen.main ?? NSScreen.screens[0]
  let visible = screen.visibleFrame
  topEdge = visible.maxY - visible.height * topShare
  let size = panel.frame.size
  panel.setFrameOrigin(NSPoint(x: visible.midX - size.width / 2, y: topEdge - size.height))
}

/** Grows and shrinks downward from its top edge, up to a share of the screen; the page scrolls the rest. */
func fit(pageHeight: CGFloat) {
  let screen = (panel.screen ?? NSScreen.main ?? NSScreen.screens[0]).visibleFrame
  let height = min(max(pageHeight, minHeight), screen.height * maxScreenShare).rounded()
  guard abs(height - panel.frame.height) >= 1 else { return }
  if topEdge == 0 { topEdge = panel.frame.maxY }
  panel.setFrame(NSRect(x: panel.frame.minX, y: topEdge - height, width: width, height: height), display: true)
}

func claimHotkey(_ text: String) {
  guard let combo = keyCombo(from: text) else {
    return FileHandle.standardError.write("[quick panel] \"\(text)\" isn't a key combo it knows.\n".data(using: .utf8)!)
  }
  if !claim(combo, onPress: toggle) {
    FileHandle.standardError.write("[quick panel] \(text) is taken by another app; set ui.quickPanelHotkey.\n".data(using: .utf8)!)
  }
}

func run(_ command: Substring) {
  if command.hasPrefix("load "), let url = URL(string: String(command.dropFirst("load ".count))) {
    pageGuard.origin = url
    webView.load(URLRequest(url: url))
  } else if command.hasPrefix("hotkey ") {
    claimHotkey(String(command.dropFirst("hotkey ".count)))
  }
}

FileHandle.standardInput.readabilityHandler = { input in
  let chunk = input.availableData
  if chunk.isEmpty { exit(0) }
  let commands = String(decoding: chunk, as: UTF8.self).split(separator: "\n")
  DispatchQueue.main.async { commands.forEach(run) }
}

app.run()
