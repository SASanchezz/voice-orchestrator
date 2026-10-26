from collections.abc import Callable

from hands import fist, open_hand, seen

from gestures.events import GestureTap
from gestures.landmarks import Hand
from gestures.swipes import NEVER, SWIPE_LEFT, SWIPE_RIGHT, SwipeConfig, SwipeDetector

FRAME_MS = 33
CONFIG = SwipeConfig(window_ms=500, min_travel=0.25, min_open_share=0.6, cooldown_ms=800, still_speed=0.3)

HandAt = Callable[[float], Hand]


class Scene:
    """Moves a hand across the raw frame, one frame every FRAME_MS, and collects the taps."""

    def __init__(self) -> None:
        self.detector = SwipeDetector(CONFIG)
        self.ts = 0
        self.taps: list[GestureTap] = []

    def move(self, start_x: float, end_x: float, ms: int, shape: HandAt = open_hand) -> None:
        steps = ms // FRAME_MS
        for step in range(1, steps + 1):
            self.frame(shape(start_x + (end_x - start_x) * step / steps))

    def hold(self, x: float, ms: int) -> None:
        self.move(x, x, ms)

    def frame(self, hand: Hand) -> None:
        self.ts += FRAME_MS
        self.taps += self.detector.update(self.ts, [seen(hand)])

    def names(self) -> list[str]:
        return [tap.name for tap in self.taps]


def test_moving_towards_smaller_x_is_a_swipe_to_the_users_right() -> None:
    scene = Scene()
    scene.move(0.7, 0.3, 300)
    assert scene.names() == [SWIPE_RIGHT]


def test_moving_towards_larger_x_is_a_swipe_to_the_users_left() -> None:
    scene = Scene()
    scene.move(0.3, 0.7, 300)
    assert scene.names() == [SWIPE_LEFT]


def test_a_swipe_belongs_to_the_hand_that_made_it() -> None:
    scene = Scene()
    scene.move(0.3, 0.7, 300)
    assert scene.taps[0].hand == "right"


def test_a_short_move_is_no_swipe() -> None:
    scene = Scene()
    scene.move(0.5, 0.6, 300)
    assert scene.taps == []


def test_a_slow_move_is_no_swipe() -> None:
    scene = Scene()
    scene.move(0.2, 0.8, 3000)
    assert scene.taps == []


def test_a_fist_moving_is_no_swipe() -> None:
    scene = Scene()
    scene.move(0.3, 0.7, 300, shape=fist)
    assert scene.taps == []


def test_a_diagonal_move_is_no_swipe() -> None:
    scene = Scene()
    for step in range(1, 10):
        scene.frame(open_hand(0.3 + step * 0.04, y=0.2 + step * 0.04))
    assert scene.taps == []


def test_swinging_back_right_after_a_swipe_is_ignored() -> None:
    scene = Scene()
    scene.move(0.3, 0.7, 300)
    scene.move(0.7, 0.3, 300)
    assert scene.names() == [SWIPE_LEFT]


def test_another_swipe_counts_once_the_cooldown_is_over() -> None:
    scene = Scene()
    scene.move(0.3, 0.7, 300)
    scene.hold(0.7, CONFIG.cooldown_ms)
    scene.move(0.7, 0.3, 300)
    assert scene.names() == [SWIPE_LEFT, SWIPE_RIGHT]


def test_a_moving_hand_is_busy() -> None:
    scene = Scene()
    scene.move(0.5, 0.55, 100)
    assert scene.detector.busy_until(scene.ts)["right"] == scene.ts


def test_a_still_hand_is_not_busy() -> None:
    scene = Scene()
    scene.hold(0.5, 300)
    assert scene.detector.busy_until(scene.ts)["right"] == NEVER


def test_a_hand_is_busy_for_the_cooldown_after_a_swipe() -> None:
    scene = Scene()
    scene.move(0.3, 0.7, 300)
    swiped_at = scene.taps[0].ts
    assert scene.detector.busy_until(scene.ts)["right"] == swiped_at + CONFIG.cooldown_ms


def test_the_other_hand_is_not_busy() -> None:
    scene = Scene()
    scene.move(0.5, 0.55, 100)
    assert scene.detector.busy_until(scene.ts)["left"] == NEVER
