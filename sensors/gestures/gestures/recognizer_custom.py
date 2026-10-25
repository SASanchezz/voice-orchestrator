"""Your trained gestures: classifies each hand another recognizer found, from its landmark features."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from typing import TYPE_CHECKING, Protocol

import numpy as np

from .events import NO_GESTURE
from .landmarks import features
from .recognizer_canned import Sighting

if TYPE_CHECKING:
    from .recognizers import Recognizer

# In `both` mode, a trained gesture replaces the built-in reading from this probability on.
CUSTOM_WINS_AT = 0.8

# (built-in reading, trained reading) -> the reading to use
Choice = Callable[[Sighting, Sighting], Sighting]


class Classifier(Protocol):
    def classify(self, rows: np.ndarray) -> list[tuple[str, float]]: ...


class CustomRecognizer:
    def __init__(self, hands: Recognizer, classifier: Classifier, choose: Choice) -> None:
        self._hands = hands
        self._classifier = classifier
        self._choose = choose

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]:
        sightings = self._hands.detect(frame_bgr, timestamp_ms)
        if not sightings:
            return []
        readings = self._classifier.classify(np.stack([features(sighting.hand) for sighting in sightings]))
        return [self._choose_reading(sighting, reading) for sighting, reading in zip(sightings, readings, strict=True)]

    def _choose_reading(self, sighting: Sighting, reading: tuple[str, float]) -> Sighting:
        gesture, confidence = reading
        return self._choose(sighting, replace(sighting, gesture=gesture, confidence=confidence))


def trained_only(_built_in: Sighting, trained: Sighting) -> Sighting:
    return trained


def trained_when_confident(built_in: Sighting, trained: Sighting) -> Sighting:
    is_confident = trained.gesture != NO_GESTURE and trained.confidence >= CUSTOM_WINS_AT
    return trained if is_confident else built_in
