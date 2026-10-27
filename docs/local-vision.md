# Local vision model for look_at_camera (M6)

With `camera.describer: local` in `config/config.yaml`, a vision model on your Mac looks at the camera frame and
Claude only gets its words. This page sets the model up and shows how the app talks to it.

A quick camera question ("can you see me?", "what am I holding?", "what is this?" while pointing; at most 15 words)
skips Claude entirely: the local model answers it in a sentence or two, which is spoken and shown, and Claude reads the
exchange with your next message. Anything else, or a camera that can't answer (Gestures off, server down), goes to
Claude as usual. The phrases are in `src/orchestrator/conversation/camera-question.ts`.

## The ideas in five lines

- **llama.cpp** runs language models on your machine; on Apple silicon it uses the GPU through Metal.
  `llama-server` is its HTTP server (`brew install llama.cpp`; already installed here).
- **GGUF** is llama.cpp's model file format. Names like `Q4_K_M` or `Q8_0` are the **quantization**: weights stored
  in about 4 or 8 bits instead of 16. Smaller and faster, slightly worse. Q4_K_M is the usual sweet spot.
- A vision model comes as **two files**: the language model GGUF and an **mmproj** ("multimodal projector") GGUF.
  The projector turns image patches into tokens the language model can read. Without it the model is text-only.
- An image costs **tokens**: hundreds to a few thousand per frame, depending on its size. That is most of the time
  a description takes, more than writing the answer.
- `llama-server` speaks the **OpenAI chat-completions API** (`POST /v1/chat/completions`), so any OpenAI-style client
  works with it, and so does our 30-line `LlamaDescriber`.

## Step 1: run a model

```sh
llama-server -hf ggml-org/Qwen2.5-VL-3B-Instruct-GGUF --port 8080
```

`-hf` downloads the model **and** its mmproj from Hugging Face on the first run (about 3 GB, cached in
`~/Library/Caches/llama.cpp/`), then loads both. Wait for `server is listening on http://127.0.0.1:8080`.

Models worth trying (all from the `ggml-org` account, same `-hf` flag):

| Model                         | Size  | Notes                                              |
| ----------------------------- | ----- | -------------------------------------------------- |
| `Qwen2.5-VL-3B-Instruct-GGUF` | ~3 GB | Good at reading text (labels, screens). Start here |
| `gemma-3-4b-it-GGUF`          | ~3 GB | Good general descriptions                          |
| `Qwen2.5-VL-7B-Instruct-GGUF` | ~6 GB | Clearly better, about twice as slow                |
| `SmolVLM2-2.2B-Instruct-GGUF` | ~2 GB | Fastest, weakest                                   |

Newer builds appear often: search Hugging Face for `ggml-org` + `VL` or `vision`.

## Step 2: talk to it by hand

Open http://127.0.0.1:8080 in a browser: llama-server has a chat page where you can drop in a photo and ask about it.
Then do the same thing as raw HTTP, which is exactly what the app will do:

```sh
IMG=$(base64 -i ~/Desktop/some-photo.jpg)
curl -s http://127.0.0.1:8080/v1/chat/completions -H 'Content-Type: application/json' -d @- <<EOF | jq .
{
  "messages": [
    { "role": "user", "content": [
      { "type": "text", "text": "What is in this picture?" },
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,$IMG" } }
    ] }
  ],
  "max_tokens": 200
}
EOF
```

Look at the whole reply: where the text is, what `usage.prompt_tokens` says (the image's cost), and the `timings`
block llama-server adds (`prompt_ms` is reading the image, `predicted_ms` is writing the answer).
Stop the server and run the same curl: that is the error the app has to turn into words.

## Step 3: how the app does the same

`src/camera/llama-chat.ts` is that curl in code:

- `chatRequest(frame, question, prompt)` builds the JSON you sent by hand: a system prompt, then the
  user's question and the frame as a `data:image/jpeg;base64,…` URL, with `max_tokens` capping the answer's length.
- `replyText(reply)` takes `choices[0].message.content` out of the reply. The reply comes from outside the process,
  so a zod schema checks it first; an unexpected shape becomes a readable error.
- `src/camera/vision-prompts.ts` holds the two prompts: `DESCRIBE_FOR_ASSISTANT` (details for Claude, up to 150
  tokens) and `ANSWER_ALOUD` (the quick spoken answer, up to 60 tokens).

Around it: `LlamaDescriber` (the HTTP call, 30 s timeout, errors, latency log), `DescribedView` (what Claude reads),
the `camera` config section and the switch in `src/app/build-camera.ts`. `src/camera/llama-chat.test.ts` and
`llama-describer.test.ts` show what each part does.

## Step 4: use it and compare

1. In `config/config.yaml`: `camera: { describer: local }` (and `visionServer` if you changed the port). Restart the app.
2. Keep `llama-server` running, turn Gestures on, hold something up and ask "what is this?".
   The app log shows `[camera] described locally in … ms`.
3. Try the same questions with `describer: claude`. Note it in docs/gestures-plan.md (M6). For example:

| Question                    | local: right? | local: ms | claude: right? | claude: s |
| --------------------------- | ------------- | --------- | -------------- | --------- |
| what am I holding?          |               |           |                |           |
| read this label             |               |           |                |           |
| how many fingers do I show? |               |           |                |           |

Things to try when tuning: `--image-max-tokens 400` on llama-server (fewer image tokens, much faster reading;
small text gets harder); a bigger model; another quantization (`-hf ggml-org/…-GGUF:Q8_0`); the prompts in `vision-prompts.ts`;
a smaller frame (the sensor writes up to 1568 px; fewer pixels mean fewer image tokens, but text gets harder to read).

## When it doesn't work

- `not reachable`: llama-server isn't running, or it's on another port than `camera.visionServer`.
- `answered 400` mentioning images or multimodal: the mmproj wasn't loaded. Use `-hf`, or pass both files yourself:
  `llama-server -m model.gguf --mmproj mmproj.gguf`.
- Very slow (tens of seconds): check the log says it offloaded layers to Metal; try a smaller model or quantization.
