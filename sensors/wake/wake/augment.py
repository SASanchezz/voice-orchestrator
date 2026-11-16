"""More clips from the few you record: louder and quieter, and with your room's own sound mixed in."""

from __future__ import annotations

import numpy as np

YOUR_GAINS = (0.5, 1.0, 1.6)
BACKGROUND_LEVEL = 0.4
INT16_RANGE = (-32768, 32767)


class Augmenter:
    def __init__(self, backgrounds: list[np.ndarray], rng: np.random.Generator) -> None:
        self._backgrounds = [background for background in backgrounds if len(background)]
        self._rng = rng

    def your_variants(self, clip: np.ndarray) -> list[np.ndarray]:
        louder_and_quieter = [self._clipped(clip.astype(np.float64) * gain) for gain in YOUR_GAINS]
        return louder_and_quieter + self._with_room(clip)

    def synthetic_variants(self, clip: np.ndarray) -> list[np.ndarray]:
        return [clip, *self._with_room(clip)]

    def _with_room(self, clip: np.ndarray) -> list[np.ndarray]:
        """The clip over a stretch of one of your `other` recordings; none until you've made some."""
        if not self._backgrounds:
            return []
        background = self._backgrounds[self._rng.integers(len(self._backgrounds))]
        stretch = np.resize(background, len(clip) + len(background))
        start = self._rng.integers(len(background))
        room = stretch[start : start + len(clip)].astype(np.float64)
        return [self._clipped(clip.astype(np.float64) + BACKGROUND_LEVEL * room)]

    @staticmethod
    def _clipped(samples: np.ndarray) -> np.ndarray:
        return np.clip(samples, *INT16_RANGE).astype(np.int16)
