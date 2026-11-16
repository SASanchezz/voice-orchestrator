"""Many more voices than yours: the wake word and ordinary sentences said by macOS `say` in each English voice, so the
model learns the word rather than one voice. Made once into data/synthetic/ and reused; nothing leaves this Mac."""

from __future__ import annotations

import hashlib
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .recordings import read_samples

WAKE_LINES = ("Hey Oracle.", "Hey, Oracle!", "Hey Oracle?")
# sound like the wake word and must not wake it: said by every voice
NEAR_MISS_LINES = (
    "Hey.", "Hey there!", "Hey Laura!", "Hey Rachel.", "Hey Siri.", "Hey Google.", "Hey Alexa.", "Hey Jarvis.",
    "Hey Cora.", "Hey Oliver.", "Hey Olga.", "Hey Dorothy.", "Hey Carol.", "Hey Orca.", "Hey, order pizza.",
    "Hey, all good?", "Hey, horrible!", "Hey, Corolla.", "Oracle database.", "The oracle said so.", "A miracle.",
    "Or a cool idea.", "Hey Ora.", "Hey, a call!", "Okay, the Oracle database is down.", "Ask Oracle support.",
    "We moved off Oracle last year.", "The oracle database needs a restart.", "Hey, the oracle is slow.",
)  # fmt: skip
# ordinary talk: each said by a few voices
ORDINARY_LINES = (
    "Please run the tests in the billing project.",
    "Open the pull request and check the comments.",
    "What's the weather like tomorrow?",
    "Can you read me the last message?",
    "I think the build failed again.",
    "Let me check the logs first.",
    "Send it to the team channel.",
    "Commit the changes and push the branch.",
    "Coral reefs are beautiful this time of year.",
    "Here's the oral report on the quarterly numbers.",
    "We should move the meeting to Thursday afternoon.",
    "The deployment is stuck waiting for approval.",
    "Could you summarize what changed since yesterday?",
    "I'm going to grab a coffee, back in five minutes.",
    "The integration tests are flaky on the main branch.",
    "Let's rename this function and update the callers.",
    "Show me the diff for the configuration file.",
    "Remind me to call the dentist on Monday.",
    "How many tasks are still running right now?",
    "The reviewers asked for more tests around the parser.",
    "Honestly, I'm not sure that's the right approach.",
    "Turn the volume down a little, please.",
    "Stop the worker in the analytics session.",
    "Order more paper for the printer.",
    "Our customers reported a bug in the login form.",
    "Hold on, let me think about it for a second.",
    "The new release goes out on the first of the month.",
    "Who wrote this code, and why is it so slow?",
    "Read the error and tell me what it means.",
    "I'd rather keep the old behaviour for now.",
)
WORDS_PER_MINUTE = (150, 190, 230)
USUAL_RATE = WORDS_PER_MINUTE[1]
VOICES_PER_ORDINARY_LINE = 8
# macOS's joke voices sing, bubble or whisper; nobody wakes the app like that
NOVELTY_VOICES = {
    "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Good News", "Jester", "Organ",
    "Superstar", "Trinoids", "Whisper", "Wobble", "Zarvox",
}  # fmt: skip
VOICE_LINE = re.compile(r"^(?P<name>.+?)\s+en_[A-Z]{2}\s+#")
SAY_FORMAT = "--data-format=LEI16@16000"
PARALLEL_SAYS = 8
# several `say`s at once now and then make a near-empty clip; such a clip is made again. Its size can't tell: `say`
# writes a few KB of header even then
MIN_CLIP_SAMPLES = 1_600  # a tenth of a second at 16 kHz
SAY_ATTEMPTS = 3


def english_voices() -> list[str]:
    return english_voices_in(subprocess.run(["say", "-v", "?"], capture_output=True, text=True, check=True).stdout)


def english_voices_in(listing: str) -> list[str]:
    """The English voices in `say -v ?`'s listing, each once, without the joke voices."""
    names = [match["name"] for line in listing.splitlines() if (match := VOICE_LINE.match(line))]
    return sorted(set(names) - NOVELTY_VOICES)


class SyntheticSpeech:
    def __init__(self, root: Path, voices: list[str]) -> None:
        self._root = root
        self._voices = voices

    def wake_clips(self) -> list[Path]:
        jobs = [(line, voice, rate) for line in WAKE_LINES for voice in self._voices for rate in WORDS_PER_MINUTE]
        return self._said_all(jobs)

    def near_miss_clips(self) -> list[Path]:
        return self._said_all([(line, voice, USUAL_RATE) for line in NEAR_MISS_LINES for voice in self._voices])

    def ordinary_clips(self) -> list[Path]:
        lines = enumerate(ORDINARY_LINES)
        return self._said_all([(line, voice, USUAL_RATE) for index, line in lines for voice in self._voices_for(index)])

    def _voices_for(self, line_index: int) -> list[str]:
        """A few voices per sentence, different ones for each, the same every run."""
        first = line_index * VOICES_PER_ORDINARY_LINE
        return [self._voices[(first + offset) % len(self._voices)] for offset in range(VOICES_PER_ORDINARY_LINE)]

    def _said_all(self, jobs: list[tuple[str, str, int]]) -> list[Path]:
        with ThreadPoolExecutor(PARALLEL_SAYS) as pool:
            return list(pool.map(lambda job: self._said(*job), jobs))

    def _said(self, line: str, voice: str, rate: int) -> Path:
        key = hashlib.sha1(f"{line}|{voice}|{rate}".encode()).hexdigest()[:16]
        path = self._root / f"{key}.wav"
        if path.exists() and self._is_whole(path):
            return path
        self._root.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(".part.wav")  # a stopped run leaves no half-made clip behind as a whole one
        for _attempt in range(SAY_ATTEMPTS):
            self._say(line, voice, rate, partial)
            if self._is_whole(partial):
                partial.rename(path)
                return path
        raise RuntimeError(f"macOS `say` kept making an empty clip in {voice}")

    @staticmethod
    def _is_whole(path: Path) -> bool:
        return len(read_samples(path)) >= MIN_CLIP_SAMPLES

    @staticmethod
    def _say(line: str, voice: str, rate: int, path: Path) -> None:
        command = ["say", "-v", voice, "-r", str(rate), "-o", str(path), SAY_FORMAT, line]
        said = subprocess.run(command, stderr=subprocess.PIPE, text=True, check=False)
        if said.returncode != 0:
            raise RuntimeError(f"macOS `say` couldn't speak in {voice}: {said.stderr.strip()}")
