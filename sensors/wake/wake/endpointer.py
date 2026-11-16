"""After the wake word: has the speaker finished, or never started? Decided one 80 ms frame at a time."""

from __future__ import annotations

from dataclasses import dataclass

SPEECH_END = "speech_end"
NO_SPEECH = "no_speech"


@dataclass(frozen=True)
class EndpointConfig:
    frame_ms: int = 80
    # the tail of the wake word and the start tone are not your message
    grace_ms: int = 300
    # less speech than this is a cough or a click, not words
    min_speech_ms: int = 240
    end_silence_ms: int = 1500
    no_speech_ms: int = 4000
    max_ms: int = 60_000
    speech_threshold: float = 0.5


class Endpointer:
    def __init__(self, config: EndpointConfig) -> None:
        self._config = config
        self.start()

    def start(self) -> None:
        self._elapsed_ms = 0
        self._speech_ms = 0
        self._silence_ms = 0

    def step(self, speech_probability: float) -> str | None:
        """SPEECH_END, NO_SPEECH, or None while it can't tell yet."""
        self._elapsed_ms += self._config.frame_ms
        if self._elapsed_ms <= self._config.grace_ms:
            return None
        self._count(speech_probability >= self._config.speech_threshold)
        return self._verdict()

    def _count(self, is_speech: bool) -> None:
        if is_speech:
            self._speech_ms += self._config.frame_ms
            self._silence_ms = 0
        else:
            self._silence_ms += self._config.frame_ms

    def _verdict(self) -> str | None:
        heard_words = self._speech_ms >= self._config.min_speech_ms
        if heard_words and self._silence_ms >= self._config.end_silence_ms:
            return SPEECH_END
        if self._elapsed_ms >= self._config.max_ms:
            return SPEECH_END
        if not heard_words and self._elapsed_ms >= self._config.no_speech_ms:
            return NO_SPEECH
        return None
