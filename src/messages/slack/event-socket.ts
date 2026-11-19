/** A text WebSocket as the Socket Mode connection uses it; tests pass a fake. */
export interface EventSocket {
  onText(heard: (text: string) => void): void;
  /** Called once, whether the socket was closed by either side or failed. */
  onClose(closed: () => void): void;
  send(text: string): void;
  close(): void;
}

/** Node's built-in WebSocket. */
export function webSocketTo(url: string): EventSocket {
  const socket = new WebSocket(url);
  return {
    onText: (heard) => socket.addEventListener("message", (event) => passText(event.data, heard)),
    onClose: (closed) => socket.addEventListener("close", () => closed()),
    send: (text) => socket.send(text),
    close: () => socket.close(),
  };
}

function passText(data: unknown, heard: (text: string) => void): void {
  if (typeof data === "string") heard(data);
}
