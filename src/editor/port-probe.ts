import { connect } from "node:net";

const LOOPBACK = "127.0.0.1";

/** Whether something on 127.0.0.1 takes connections on the port. */
export function isListening(port: number): Promise<boolean> {
  return new Promise((settle) => {
    const socket = connect(port, LOOPBACK);
    socket.once("connect", () => {
      socket.destroy();
      settle(true);
    });
    socket.once("error", () => settle(false));
  });
}
