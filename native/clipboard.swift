// Prints what the clipboard holds as one JSON object, read only when the user asks for it:
//   {"files": [paths]}                         files copied in Finder (their icons and names are left out)
//   {"image": {"png", "preview"}, "text": …}   either or both; base64 PNG, and a JPEG preview no bigger than a
//                                              screen snapshot so the model can look at it cheaply
//   {}                                         nothing the app can use
import AppKit

let previewMaxEdge: CGFloat = 1568
let previewQuality = 0.8
let pasteboard = NSPasteboard.general

func copiedFiles() -> [String] {
  let options: [NSPasteboard.ReadingOptionKey: Any] = [.urlReadingFileURLsOnly: true]
  let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: options) as? [URL] ?? []
  return urls.map { $0.path }
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
let copied: [String: Any] = files.isEmpty ? copiedImageAndText() : ["files": files]
let json = try JSONSerialization.data(withJSONObject: copied)
FileHandle.standardOutput.write(json)
