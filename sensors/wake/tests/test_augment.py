import numpy as np

from wake.augment import YOUR_GAINS, Augmenter

CLIP = np.full(1600, 30_000, dtype=np.int16)
ROOM = np.full(800, 1_000, dtype=np.int16)


def augmenter(backgrounds: list[np.ndarray]) -> Augmenter:
    return Augmenter(backgrounds, np.random.default_rng(0))


def test_your_clip_is_made_louder_and_quieter() -> None:
    assert len(augmenter([]).your_variants(CLIP)) == len(YOUR_GAINS)


def test_with_room_recordings_your_clip_is_also_mixed_with_the_room() -> None:
    assert len(augmenter([ROOM]).your_variants(CLIP)) == len(YOUR_GAINS) + 1


def test_a_louder_clip_is_clipped_instead_of_wrapping_around() -> None:
    assert max(int(variant.max()) for variant in augmenter([]).your_variants(CLIP)) == 32767


def test_the_room_mix_keeps_the_clips_length() -> None:
    assert len(augmenter([ROOM]).synthetic_variants(CLIP)[1]) == len(CLIP)
