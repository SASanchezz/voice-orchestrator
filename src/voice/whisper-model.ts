import { createWriteStream, mkdirSync, renameSync, type WriteStream } from "node:fs";
import { basename, dirname } from "node:path";
import { DownloadProgress } from "./download-progress.js";

const MODEL_NAME = /^ggml-[\w.-]+\.bin$/;
const DEFAULT_MODEL_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

/**
 * Homebrew's whisper-cpp ships without models. Fetch the one named in config
 * (e.g. ggml-small.en.bin) from the official whisper.cpp model repo, once.
 */
export async function downloadWhisperModel(path: string): Promise<void> {
  const name = basename(path);
  if (!MODEL_NAME.test(name))
    throw new Error(
      `Whisper model not found at ${path}, and "${name}" isn't a standard model name to download. Put the file there or fix voice.whisperModel.`,
    );
  const url = `${process.env.VO_WHISPER_MODEL_BASE ?? DEFAULT_MODEL_BASE}/${name}`;
  console.log(`Whisper model missing; downloading ${name} (one time) to ${path}`);
  mkdirSync(dirname(path), { recursive: true });
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) from ${url}`);
  await saveDownload(res.body, path, Number(res.headers.get("content-length")) || 0);
  console.log("\n  done.");
}

/** Only a complete file ever lands at the real path. */
async function saveDownload(body: AsyncIterable<Uint8Array>, path: string, total: number): Promise<void> {
  const partial = `${path}.part`;
  const received = await writeWithProgress(body, createWriteStream(partial), total);
  if (total && received !== total) throw new Error(`Download incomplete (${received}/${total} bytes); run again.`);
  renameSync(partial, path);
}

async function writeWithProgress(body: AsyncIterable<Uint8Array>, out: WriteStream, total: number): Promise<number> {
  const progress = new DownloadProgress(total);
  for await (const chunk of body) {
    if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
    progress.add(chunk.length);
  }
  await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())));
  return progress.received;
}
