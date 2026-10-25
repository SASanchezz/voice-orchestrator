from types import SimpleNamespace

from gestures.landmarks import LANDMARK_COUNT, hand_from


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
