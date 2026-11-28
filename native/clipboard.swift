// Prints what the clipboard holds as one JSON object, read only when the user asks for it:
//   {"files": [paths]}                         files or folders copied in Finder or VS Code's Explorer (desktop
//                                              or the web UI's Code view)
//                                              (their icons and names are left out)
//   {"image": {"png", "preview"}, "text": …}   either or both; base64 PNG, and a JPEG preview no bigger than a
//                                              screen snapshot so the model can look at it cheaply
//   {}                                         nothing the app can use
// With --files-only it prints just {"files": [paths]}, empty when none were copied, so a paste skips the image work.
import AppKit

let previewMaxEdge: CGFloat = 1568
let previewQuality = 0.8
let pasteboard = NSPasteboard.general

// Desktop VS Code's Explorer copies files and folders as this type only, one file:// URI per line, with no file URLs.
let vsCodeFileList = NSPasteboard.PasteboardType("code/file-list")
// VS Code in a browser page (the web UI's Code view) can only write a web custom format: Chrome lists each one in
// this map, by MIME type, under a pasteboard type of its own.
let webCustomFormatMap = NSPasteboard.PasteboardType("org.w3.web-custom-format.map")
let vsCodeResourcesFormat = "application/vnd.code.resources"

func copiedFiles() -> [String] {
  let fromFinder = finderFiles()
  if !fromFinder.isEmpty { return fromFinder }
  let fromDesktopVSCode = vsCodeFiles()
  return fromDesktopVSCode.isEmpty ? webVSCodeFiles() : fromDesktopVSCode
}

func finderFiles() -> [String] {
  let options: [NSPasteboard.ReadingOptionKey: Any] = [.urlReadingFileURLsOnly: true]
  let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: options) as? [URL] ?? []
  return urls.map { $0.path }
}

func vsCodeFiles() -> [String] {
  guard let list = pasteboard.data(forType: vsCodeFileList), let text = String(data: list, encoding: .utf8)
  else { return [] }
  let urls = text.split(whereSeparator: \.isNewline).compactMap { URL(string: String($0)) }
  return urls.filter { $0.isFileURL }.map { $0.path }
}

// A JSON list of VS Code URIs; fsPath is the path on this Mac, also for the Code view's vscode-remote ones.
func webVSCodeFiles() -> [String] {
  guard let resourcesType = webCustomFormatType(of: vsCodeResourcesFormat),
    let resources = pasteboard.data(forType: resourcesType),
    let uris = (try? JSONSerialization.jsonObject(with: resources)) as? [[String: Any]]
  else { return [] }
  return uris.compactMap { $0["fsPath"] as? String }
}

func webCustomFormatType(of mimeType: String) -> NSPasteboard.PasteboardType? {
  guard let map = pasteboard.data(forType: webCustomFormatMap),
    let types = (try? JSONSerialization.jsonObject(with: map)) as? [String: String],
    let type = types[mimeType]
  else { return nil }
  return NSPasteboard.PasteboardType(type)
}

func copiedPNG() -> Data? {
  if let png = pasteboard.data(forType: .png) { return png }
  guard let tiff = pasteboard.data(forType: .tiff) else { return nil }
  return NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:])
}

func previewJPEG(of png: Data) -> Data? {
  guard let image = NSBitmapImageRep(data: png)?.cgImage else { return nil }
  let scale = min(1, previewMaxEdge / CGFloat(max(image.width, image.height)))
  let width = max(1, Int(CGFloat(image.width) * scale))
  let height = max(1, Int(CGFloat(image.height) * scale))
  guard let context = CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
  else { return nil }
  let canvas = CGRect(x: 0, y: 0, width: width, height: height)
  context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))  // JPEG has no transparency
  context.fill(canvas)
  context.interpolationQuality = .high
  context.draw(image, in: canvas)
  guard let scaled = context.makeImage() else { return nil }
  let rep = NSBitmapImageRep(cgImage: scaled)
  return rep.representation(using: .jpeg, properties: [.compressionFactor: previewQuality])
}

func copiedImageAndText() -> [String: Any] {
  var copied: [String: Any] = [:]
  if let png = copiedPNG(), let preview = previewJPEG(of: png) {
    copied["image"] = ["png": png.base64EncodedString(), "preview": preview.base64EncodedString()]
  }
  if let text = pasteboard.string(forType: .string), !text.isEmpty { copied["text"] = text }
  return copied
}

let files = copiedFiles()
let filesOnly = CommandLine.arguments.contains("--files-only")
let copied: [String: Any] = files.isEmpty && !filesOnly ? copiedImageAndText() : ["files": files]
let json = try JSONSerialization.data(withJSONObject: copied)
FileHandle.standardOutput.write(json)
