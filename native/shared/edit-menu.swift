// The Edit menu a panel needs for copy, paste and the rest to work by their usual keys, though it is never shown.
// Compiled together with each panel's own source (see src/macos/native-helper.ts).
import AppKit

func installEditMenu(in app: NSApplication) {
  let mainMenu = NSMenu()
  let editItem = NSMenuItem()
  editItem.submenu = editMenu()
  mainMenu.addItem(editItem)
  app.mainMenu = mainMenu
}

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
