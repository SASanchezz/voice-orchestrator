from dataclasses import replace
from types import SimpleNamespace

import numpy as np

from hands import fist, open_hand

from gestures.landmarks import (
    FEATURE_COUNT,
    LANDMARK_COUNT,
    MIDDLE_FINGER_BASE,
    Hand,
    features,
    hand_from,
    is_open_hand,
)


def test_keeps_side_and_score() -> None:
    hand = hand_from([SimpleNamespace(category_name="Left", score=0.8)], [])
    assert (hand.side, hand.score) == ("left", 0.8)


def test_keeps_points() -> None:
    hand = hand_from([SimpleNamespace(category_name="Right", score=0.9)], _points())
    assert hand.points[2] == (0.02, 0.04, -0.002)


def test_mirrored_flips_x_only() -> None:
    hand = hand_from([SimpleNamespace(category_name="Right", score=0.9)], _points())
    assert hand.mirrored().points[2] == (0.98, 0.04, -0.002)


def test_mirrored_keeps_the_side() -> None:
    hand = hand_from([SimpleNamespace(category_name="Right", score=0.9)], _points())
    assert hand.mirrored().side == "right"


def _points() -> list[SimpleNamespace]:
    return [SimpleNamespace(x=i / 100, y=i / 50, z=-i / 1000) for i in range(LANDMARK_COUNT)]


def a_hand(side: str = "right", shift: float = 0.0, scale: float = 1.0) -> Hand:
    points = tuple((0.3 + shift + scale * x, 0.4 + shift + scale * y, scale * z) for x, y, z in _shape())
    return Hand(side, 0.9, points)


def _shape() -> list[tuple[float, float, float]]:
    """Some uneven hand-like shape, so mirroring changes it."""
    return [(i * 0.01, (i % 5) * 0.02 + i * 0.003, -i * 0.001) for i in range(LANDMARK_COUNT)]


def test_features_have_one_number_per_coordinate() -> None:
    assert features(a_hand()).shape == (FEATURE_COUNT,)


def test_features_ignore_where_the_hand_is() -> None:
    assert np.allclose(features(a_hand(shift=0.2)), features(a_hand()))


def test_features_ignore_how_big_the_hand_looks() -> None:
    assert np.allclose(features(a_hand(scale=0.5)), features(a_hand()))


def test_features_put_the_wrist_at_the_origin() -> None:
    assert np.allclose(features(a_hand())[:3], 0.0)


def test_features_scale_the_palm_to_one() -> None:
    palm = features(a_hand()).reshape(LANDMARK_COUNT, 3)[MIDDLE_FINGER_BASE]
    assert np.isclose(np.linalg.norm(palm), 1.0)


def test_a_left_hand_looks_like_the_mirrored_right_hand() -> None:
    right = a_hand()
    left = replace(right.mirrored(), side="left")
    assert np.allclose(features(left), features(right))


def test_mirroring_a_right_hand_changes_its_features() -> None:
    right = a_hand()
    assert not np.allclose(features(right.mirrored()), features(right))


def test_features_of_a_point_sized_hand_are_finite() -> None:
    dot = Hand("right", 0.9, ((0.5, 0.5, 0.0),) * LANDMARK_COUNT)
    assert np.isfinite(features(dot)).all()


def test_stretched_fingers_are_an_open_hand() -> None:
    assert is_open_hand(open_hand(0.5))


def test_curled_fingers_are_no_open_hand() -> None:
    assert not is_open_hand(fist(0.5))
