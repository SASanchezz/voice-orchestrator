import numpy as np

from wake.endpointer import NO_SPEECH, SPEECH_END, EndpointConfig
from wake.listener import STOP_WORD, WAKE, Event, Listener, ListenerConfig

FRAME = np.zeros(1280, dtype=np.int16)
FRAME_MS = 80
CONFIG = ListenerConfig(
    threshold=0.5,
    cooldown_ms=160,
    stop_word_after_ms=160,
    wake_speech_ms=0,
    endpoint=EndpointConfig(grace_ms=0, min_speech_ms=80),
)
HEARD = 0.9
NOT_HEARD = 0.1


class FakeDetector:
    """Scores from a script, one per frame it is asked about; counts its resets."""

    def __init__(self, scores: list[float]) -> None:
        self.scores = scores
        self.resets = 0

    def score(self, frame: np.ndarray) -> float:
        return self.scores.pop(0) if self.scores else NOT_HEARD

    def reset(self) -> None:
        self.resets += 1


class FakeVoice:
    def __init__(self, probabilities: list[float]) -> None:
        self.probabilities = probabilities

    def speech_probability(self, frame: np.ndarray) -> float:
        return self.probabilities.pop(0) if self.probabilities else NOT_HEARD

    def reset(self) -> None:
        pass


def events(listener: Listener, count: int) -> list[str]:
    return [event.type for event in (listener.process(FRAME) for _ in range(count)) if event]


def frames_for(ms: int) -> int:
    """Enough whole frames to last `ms`."""
    return -(-ms // FRAME_MS)


def end_silence_frames() -> int:
    return frames_for(CONFIG.endpoint.end_silence_ms)


def a_turn() -> int:
    """Frames for the wake word, one frame of speech, the silence that ends it, and the cooldown."""
    return 1 + 1 + end_silence_frames() + frames_for(CONFIG.cooldown_ms)


def test_a_score_below_the_threshold_is_not_a_wake() -> None:
    listener = Listener(FakeDetector([0.4]), FakeVoice([]), CONFIG)
    assert events(listener, 1) == []


def test_a_score_at_the_threshold_wakes() -> None:
    listener = Listener(FakeDetector([0.5]), FakeVoice([]), CONFIG)
    assert events(listener, 1) == [WAKE]


def test_the_wake_event_carries_its_score() -> None:
    listener = Listener(FakeDetector([0.87654]), FakeVoice([]), CONFIG)
    assert listener.process(FRAME) == Event(WAKE, 0.87654)


def test_speech_after_the_wake_word_ends_with_speech_end() -> None:
    listener = Listener(FakeDetector([HEARD]), FakeVoice([HEARD] * 3), CONFIG)
    assert events(listener, 1 + 3 + end_silence_frames()) == [WAKE, SPEECH_END]


def test_silence_after_the_wake_word_ends_with_no_speech() -> None:
    no_speech_frames = frames_for(CONFIG.endpoint.no_speech_ms)
    listener = Listener(FakeDetector([HEARD]), FakeVoice([]), CONFIG)
    assert events(listener, 1 + no_speech_frames) == [WAKE, NO_SPEECH]


def test_the_wake_word_said_again_ends_the_message() -> None:
    words = frames_for(CONFIG.stop_word_after_ms) + 1
    detector = FakeDetector([HEARD] + [NOT_HEARD] * words + [HEARD])
    listener = Listener(detector, FakeVoice([HEARD] * (words + 1)), CONFIG)
    assert events(listener, 1 + words + 1) == [WAKE, STOP_WORD]


def test_the_wake_word_right_after_the_opening_one_does_not_end_the_message() -> None:
    listener = Listener(FakeDetector([HEARD, HEARD]), FakeVoice([HEARD, HEARD]), CONFIG)
    assert events(listener, 2) == [WAKE]


def test_the_detector_starts_fresh_at_the_wake_word_and_after_the_cooldown() -> None:
    detector = FakeDetector([HEARD])
    listener = Listener(detector, FakeVoice([HEARD]), CONFIG)
    events(listener, a_turn())
    assert detector.resets == 2


def test_a_second_wake_after_the_cooldown_is_heard() -> None:
    detector = FakeDetector([HEARD])
    listener = Listener(detector, FakeVoice([HEARD]), CONFIG)
    events(listener, a_turn())
    detector.scores = [HEARD]
    assert events(listener, 1) == [WAKE]


SPOKEN_CONFIG = ListenerConfig(threshold=0.5, wake_speech_ms=160, endpoint=EndpointConfig(grace_ms=0))


def test_a_wake_score_without_speech_before_it_is_not_a_wake() -> None:
    listener = Listener(FakeDetector([NOT_HEARD, HEARD]), FakeVoice([NOT_HEARD, NOT_HEARD]), SPOKEN_CONFIG)
    assert events(listener, 2) == []


def test_a_wake_score_after_speech_wakes() -> None:
    listener = Listener(FakeDetector([NOT_HEARD, HEARD]), FakeVoice([HEARD, HEARD]), SPOKEN_CONFIG)
    assert events(listener, 2) == [WAKE]


def test_too_little_speech_before_a_wake_score_is_not_a_wake() -> None:
    listener = Listener(FakeDetector([NOT_HEARD, HEARD]), FakeVoice([NOT_HEARD, HEARD]), SPOKEN_CONFIG)
    assert events(listener, 2) == []
