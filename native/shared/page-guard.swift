// What a panel showing a web UI page lets it do: stay on the page's own origin, open every other link in the default
// browser, and send the panel messages ("window.webkit.messageHandlers.panel.postMessage({...})").
// Compiled together with each panel's own source (see src/macos/native-helper.ts).
import AppKit
import WebKit

let pageMessageName = "panel"

final class PageGuard: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
  var origin: URL?
  /** Each message the page posts, as the object it posted. */
  var onMessage: ([String: Any]) -> Void = { _ in }

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
    guard let body = message.body as? [String: Any] else { return }
    onMessage(body)
  }

  private func isOwn(_ url: URL) -> Bool {
    guard let origin else { return false }
    return url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
  }
}
