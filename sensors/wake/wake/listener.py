"""Waits for the wake word, then follows your speech until you finish (you go quiet, or say the wake word again),
then rests a moment and waits again.

Each 80 ms frame is looked at once and dropped: no audio is kept, written or sent anywhere.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Protocol

import numpy as np

from .endpointer import EndpointConfig, Endpointer

WAKE = "wake"
STOP_WORD = "stop_word"


class Detector(Protocol):
    def score(self, frame: np.ndarray) -> float: ...

    def reset(self) -> None: ...


class VoiceDetector(Protocol):
    def speech_probability(self, frame: np.ndarray) -> float: ...

    def reset(self) -> None: ...


@dataclass(frozen=True)
class ListenerConfig:
    threshold: float = 0.5
    # a second wake word right after a turn is more likely an echo than you
    cooldown_ms: int = 1500
    # the wake word said again only ends your message after this long, so the opening one can't end it
    stop_word_after_ms: int = 1000
    # a wake word is spoken: without this much speech in the window before it (a mouse click, a knock), it is ignored
    wake_speech_ms: int = 160
    wake_window_ms: int = 1200
    endpoint: EndpointConfig = field(default_factory=EndpointConfig)


@dataclass(frozen=True)
class Event:
    type: str
    score: float | None = None

    def message(self) -> dict[str, object]:
        if self.score is None:
            return {"type": self.type}
        return {"type": self.type, "score": round(self.score, 3)}


class _State(Enum):
    ARMED = auto()
    FOLLOWING = auto()
    COOLING = auto()


class Listener:
    def __init__(self, detector: Detector, voice: VoiceDetector, config: ListenerConfig) -> None:
        self._detector = detector
        self._voice = voice
        self._config = config
        self._endpointer = Endpointer(config.endpoint)
        self._state = _State.ARMED
        self._cooled_ms = 0
        self._followed_ms = 0
        window_frames = max(1, config.wake_window_ms // config.endpoint.frame_ms)
        self._recent_speech: deque[bool] = deque(maxlen=window_frames)

    def process(self, frame: np.ndarray) -> Event | None:
        if self._state is _State.ARMED:
            return self._listen_for_wake_word(frame)
        if self._state is _State.FOLLOWING:
            return self._follow_speech(frame)
        self._cool_down()
        return None

    def _listen_for_wake_word(self, frame: np.ndarray) -> Event | None:
        score = self._detector.score(frame)
        was_spoken = self._was_spoken(frame)
        if score < self._config.threshold or not was_spoken:
            return None
        self._recent_speech.clear()
        self._state = _State.FOLLOWING
        self._followed_ms = 0
        self._endpointer.start()
        self._voice.reset()
        self._detector.reset()  # listen for the wake word again, without the one just heard
        return Event(WAKE, score)

    def _was_spoken(self, frame: np.ndarray) -> bool:
        """Scored on every frame while waiting, so the window always holds the speech just before the wake word."""
        if self._config.wake_speech_ms <= 0:
            return True
        probability = self._voice.speech_probability(frame)
        self._recent_speech.append(probability >= self._config.endpoint.speech_threshold)
        speech_ms = sum(self._recent_speech) * self._config.endpoint.frame_ms
        return speech_ms >= self._config.wake_speech_ms

    def _follow_speech(self, frame: np.ndarray) -> Event | None:
        self._followed_ms += self._config.endpoint.frame_ms
        said_again = self._is_stop_word(frame)
        verdict = self._endpointer.step(self._voice.speech_probability(frame))
        if said_again:
            return self._end_turn(Event(STOP_WORD))
        if verdict is None:
            return None
        return self._end_turn(Event(verdict))

    def _is_stop_word(self, frame: np.ndarray) -> bool:
        """Scored on every frame, so the detector hears the whole word, but counted only after the opening one."""
        score = self._detector.score(frame)
        return self._followed_ms > self._config.stop_word_after_ms and score >= self._config.threshold

    def _end_turn(self, event: Event) -> Event:
        self._state = _State.COOLING
        self._cooled_ms = 0
        return event

    def _cool_down(self) -> None:
        self._cooled_ms += self._config.endpoint.frame_ms
        if self._cooled_ms < self._config.cooldown_ms:
            return
        self._detector.reset()  # forget the audio from before the turn, so it can't trigger again
        self._state = _State.ARMED
