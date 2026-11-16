# wake

Wake word listener for the voice orchestrator, built on [openWakeWord](https://github.com/dscripka/openWakeWord).
Say the wake word ("Hey Oracle") and the orchestrator starts recording as if you had pressed the talk key; say
"finish" to send your words, or press Escape to discard them; pauses don't end it. You train the wake word on your own voice, in the web UI.

## How it works

- `python -m wake run` records 16 kHz mono audio with sox (`rec`, the same as push-to-talk) and looks at it 80 ms at a
  time. Each frame is scored by the wake word model and then dropped: **no audio is kept, written to disk or sent
  anywhere** by this process, and it makes no network connections. The models are downloaded once by `setup`.
- When the score reaches `--threshold`, it prints `{"type":"wake","score":0.91}`. The orchestrator then records with
  sox and whisper.cpp exactly as when you hold the talk key (you hear the start tone).
- From then on a voice detector (Silero VAD, bundled with openWakeWord) follows your speech and prints
  `{"type":"speech_end"}` after `--end-silence-ms` of quiet, `{"type":"no_speech"}` if you say nothing within
  `--no-speech-ms`, and `{"type":"stop_word"}` if you say the wake word again. The orchestrator ignores all three, so
  you can pause to think: its recording ends only when you say "finish" (sent) or press Escape (discarded).
- After each turn it rests 1.5 s, then listens for the wake word again.

The orchestrator ignores the wake word while you are already talking or dictating. Said while the assistant is
speaking, it cuts the assistant off and starts recording, as the talk key does. There is no echo cancellation, so
the mic hears the reply too: the model is trained not to wake on sentences that only sound like the wake word.

Music or other sound in the room lowers the wake word's score, because the model learns "Hey Oracle" from
recordings made in a quiet room. To have it hear you over music, record some "Hey Oracle" clips and some other talk
while music plays, and train again: those recordings are used as they are, and the voices' clips get your music mixed
in from the other talk.

While the listener runs, macOS shows the orange mic indicator, and Control Center names your terminal app as using
the mic. That is expected; the web UI's **Wake word** switch turns it off.

Cost: about 2 ms of CPU per 80 ms of audio on an M4 Pro (roughly 1–2% of one core), measured with the voice
detector running on every frame; the voice detector only runs after the wake word.

## Setup (macOS)

Python 3.11 or newer, and sox (`brew install sox`, already needed for push-to-talk).

```bash
cd sensors/wake
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m wake setup                    # openWakeWord's base models and the voice detector, once
python -m wake setup --builtin hey_jarvis   # optional: a ready-made wake word to try things out
```

Your terminal app already has **Microphone** permission for push-to-talk; nothing else is needed.

## Train "Hey Oracle" on your voice

openWakeWord has no ready-made "Hey Oracle" model, so you train one on this Mac, in the web UI: **⚙ › Wake word ›
Train…**. The dialog has four steps:

1. **Record "Hey Oracle"**: click, then say it once right away (2.5 s are recorded). 20 or more times is best:
   nearer and farther, softer and louder. A recording with no speech in it isn't kept.
2. **Record other talk**: 6 s of ordinary talk, or of your room. 5 or more is good; say "Oracle" in a sentence in some.
3. **Train**: about 2 minutes the first time, under a minute after that (progress is in the terminal). It answers
   with how the model did on a quarter of your recordings that it wasn't trained on (the wake word, your other talk,
   and your quiet room after the word), then trains again on all of them.
4. **Try it**: click, then say "Hey Oracle" (or something else) within 3 s; it says how sure the model is.

Under the steps, **Review recordings…** opens a window with your recordings, "Hey Oracle" and other talk on two
tabs, each with its waveform. Takes worth a listen first are flagged: *much quieter* than your other "Hey Oracle"
takes, *distorted* (too loud), or *cut off* (still talking at the very end). Go through them by ear: ↑ ↓ select and
play the next or previous one, Space plays it again, X ticks or unticks its checkbox, ← → switch tabs. **Select
all** ticks the whole tab, and **Select flagged** ticks the flagged ones. Nothing is deleted until you press **Delete
N selected**; a deleted recording is gone for good, and the model only changes once you train again.

The wake word listener is paused while a step runs, and starts again afterwards with the new model. If it misses
you or wakes on other talk, record more of that and train again.

How it trains (`wake/training.py`): besides your recordings, every English macOS voice says "Hey Oracle" at three
speeds, and sentences that sound alike ("Hey Laura", "The Oracle database…") and ordinary talk (`wake/synthetic.py`).
Your other talk is also made louder, quieter and mixed with your room (`wake/augment.py`); your wake word recordings
are used as they are. Each clip goes through openWakeWord's speech embeddings exactly as the live listener hears it,
with quiet at your room's own level around your recordings, and a small neural network (scikit-learn) learns which
1.28 s windows end with the wake word; the windows once the word is over, only your room, are taught as not the wake
word (`wake/windows.py`). The model is `sensors/wake/models/hey_oracle.joblib`, the default `--model`, and wakes at
0.8.

Two things here keep your own voice and room from becoming the wake word, which made any word or noise wake an
earlier version: your wake word recordings aren't copied (louder, quieter, mixed) while your other talk is, and your
room after the word is taught as not the wake word. Checked across your recordings by training without a quarter
of them at a time, that took false wakes on your held-out talk from about 5 a minute to none.

Everything stays on this Mac and is gitignored: your recordings in `data/wake/` and `data/other/`, the voices'
clips in `data/synthetic/` (made once and reused), and the model in `models/`. To start over, delete those folders.

The same steps from a terminal, each printing one JSON line:

```bash
python -m wake samples                  # how many recordings there are
python -m wake record --label wake      # or --label other
python -m wake train
python -m wake try
```

To try the flow without training, use openWakeWord's built-in model: in `config/config.yaml`,
`args: [-m, wake, run, --model, hey_jarvis]`, then say "Hey Jarvis". A model made with openWakeWord's own
[training notebook](https://github.com/dscripka/openWakeWord#training-new-models) also works: `--model` with its
`.onnx` file.

Licence: openWakeWord's code is Apache-2.0. Its ready-made models (such as `hey_jarvis`) are CC BY-NC-SA 4.0,
non-commercial only. A model you train yourself is yours.

## Use it in the orchestrator

The web UI has its own **⚙ › Wake word** switch, apart from **Gestures**. It is on until you first switch it off, and
is remembered in `state/wake-word.json`. Off stops the listener process, so the mic is open only while you talk.
The listener needs `sensors/wake/.venv` (`sensors.wakeWord.python` in `config/config.yaml`); without it, the terminal
says once that the wake word is off, and everything else works as before. Text mode has no mic, so no wake word.

## Run on its own

```bash
python -m wake run                          # wake events on stdout; Ctrl+C to stop
python -m wake run --model hey_jarvis       # a built-in model
python -m wake run --input clip.wav         # a 16 kHz mono 16-bit WAV instead of the mic
python -m wake run --threshold 0.9          # fewer false wakes, more missed ones
```

| Option             | Default                    | Meaning                                                                                     |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| `--model`          | `models/hey_oracle.joblib` | the wake word model: trained here (`.joblib`), an `.onnx` file, or a built-in name          |
| `--threshold`      | the model's own            | 0..1, how sure the model must be: 0.8 for a model trained here, 0.5 for openWakeWord's      |
| `--end-silence-ms` | 1500                       | quiet this long after you spoke: your message is done                                       |
| `--no-speech-ms`   | 4000                       | nothing said this long after the wake word: give up                                         |
| `--wake-speech-ms` | 160                        | speech needed in the 1.2 s before the wake word, so clicks and knocks don't wake it; 0: off |
| `--max-ms`         | 60000                      | the longest message after the wake word                                                     |
| `--record-bin`     | `rec`                      | sox's recorder (the orchestrator passes `voice.recordBin`)                                  |

Tune `--threshold` on your own voice and room: if it misses you, lower it; if TV or talk wakes it, raise it.

## Tests

```bash
python -m pytest
```

`tests/test_detection.py` runs the real models on speech made by macOS `say`; it is skipped until
`python -m wake setup --builtin hey_jarvis` has run. Training itself has no automated end-to-end test (it needs `say`
and takes minutes); its parts are tested one by one.
