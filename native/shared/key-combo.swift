// A key combo written as text ("ctrl+option+space", "cmd+shift+k"), claimed system-wide with the Carbon hot key API,
// which needs no Input Monitoring permission and swallows the combo so the app in front never sees it.
// The text was checked against src/config/quick-panel-config.ts; this reads the same names.
import Carbon.HIToolbox

struct KeyCombo {
  let keyCode: UInt32
  let modifiers: UInt32
}

let modifierByName: [String: Int] = [
  "cmd": cmdKey, "command": cmdKey, "ctrl": controlKey, "control": controlKey,
  "option": optionKey, "alt": optionKey, "shift": shiftKey,
]

let keyCodeByName: [String: Int] = [
  "space": kVK_Space, "return": kVK_Return, "tab": kVK_Tab,
  "a": kVK_ANSI_A, "b": kVK_ANSI_B, "c": kVK_ANSI_C, "d": kVK_ANSI_D, "e": kVK_ANSI_E, "f": kVK_ANSI_F,
  "g": kVK_ANSI_G, "h": kVK_ANSI_H, "i": kVK_ANSI_I, "j": kVK_ANSI_J, "k": kVK_ANSI_K, "l": kVK_ANSI_L,
  "m": kVK_ANSI_M, "n": kVK_ANSI_N, "o": kVK_ANSI_O, "p": kVK_ANSI_P, "q": kVK_ANSI_Q, "r": kVK_ANSI_R,
  "s": kVK_ANSI_S, "t": kVK_ANSI_T, "u": kVK_ANSI_U, "v": kVK_ANSI_V, "w": kVK_ANSI_W, "x": kVK_ANSI_X,
  "y": kVK_ANSI_Y, "z": kVK_ANSI_Z,
  "0": kVK_ANSI_0, "1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3, "4": kVK_ANSI_4,
  "5": kVK_ANSI_5, "6": kVK_ANSI_6, "7": kVK_ANSI_7, "8": kVK_ANSI_8, "9": kVK_ANSI_9,
]

/** Nil for text that names an unknown key or modifier, or has no modifier. */
func keyCombo(from text: String) -> KeyCombo? {
  let names = text.lowercased().split(separator: "+").map(String.init)
  guard let keyName = names.last, let keyCode = keyCodeByName[keyName], names.count > 1 else { return nil }
  let modifiers = names.dropLast().map { modifierByName[$0] }
  guard modifiers.allSatisfy({ $0 != nil }) else { return nil }
  return KeyCombo(keyCode: UInt32(keyCode), modifiers: UInt32(modifiers.reduce(0) { $0 | ($1 ?? 0) }))
}

/** Static, because the Carbon event handler is a C callback and cannot capture anything. */
enum ClaimedCombo {
  nonisolated(unsafe) static var pressed: () -> Void = {}
  nonisolated(unsafe) static var ref: EventHotKeyRef?
}

/** False when another app already holds the combo. */
func claim(_ combo: KeyCombo, onPress: @escaping () -> Void) -> Bool {
  ClaimedCombo.pressed = onPress
  var pressedEvent = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
  InstallEventHandler(GetApplicationEventTarget(), { _, _, _ in
    DispatchQueue.main.async { ClaimedCombo.pressed() }
    return noErr
  }, 1, &pressedEvent, nil, nil)
  let id = EventHotKeyID(signature: OSType(0x564F_5150), id: 1)  // "VOQP"
  let status = RegisterEventHotKey(
    combo.keyCode, combo.modifiers, id, GetApplicationEventTarget(), 0, &ClaimedCombo.ref)
  return status == noErr
}
