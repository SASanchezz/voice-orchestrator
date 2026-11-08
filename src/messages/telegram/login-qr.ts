import QRCode from "qrcode";

const SCAN_STEPS = [
  "On your phone, open Telegram › Settings › Devices › Link Desktop Device and scan this code.",
  "It changes every 30 seconds; scan the newest one. No SMS or login code is needed.",
].join("\n");

/** Telegram's login link for a QR token: the Telegram app opens it when it scans the code. */
export function loginLink(token: Buffer): string {
  return `tg://login?token=${token.toString("base64url")}`;
}

/** Replaces the previous code on screen, so only the one that still works is shown. */
export async function showLoginQr(token: Buffer): Promise<void> {
  const qr = await QRCode.toString(loginLink(token), { type: "terminal", small: true });
  console.clear();
  console.log(`${SCAN_STEPS}\n\n${qr}`);
}
