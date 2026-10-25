from dataclasses import dataclass

from gestures.events import GestureEnd, GestureEvent, GestureStart
from gestures.stabilizer import Stabilizer, StabilizerConfig

FRAME_MS = 33
CONFIG = StabilizerConfig(min_hold_ms=250, min_confidence=0.7, release_ms=200, cooldown_ms=1000)


@dataclass(frozen=True)
class Seen:
    side: str
    gesture: str
    confidence: float = 0.9


class Scene:
    """Feeds the stabilizer one frame every FRAME_MS and collects what it emits."""

    def __init__(self) -> None:
        self.stabilizer = Stabilizer(CONFIG)
        self.ts = 0
        self.events: list[GestureEvent] = []

    def show(self, ms: int, *seen: Seen) -> None:
        for _ in range(ms // FRAME_MS):
            self.ts += FRAME_MS
            self.events += self.stabilizer.update(self.ts, seen)

    def nothing(self, ms: int) -> None:
        self.show(ms)

    def phases(self) -> list[tuple[str, str, str]]:
        return [(_phase(event), event.hand, event.name) for event in self.events]


def _phase(event: GestureEvent) -> str:
    return "start" if isinstance(event, GestureStart) else "end"


PALM = Seen("right", "open_palm")
FIST = Seen("right", "closed_fist")


def test_a_held_gesture_starts_once() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    assert scene.phases() == [("start", "right", "open_palm")]


def test_start_waits_for_the_minimum_hold() -> None:
    scene = Scene()
    scene.show(330, PALM)
    assert scene.events[0].ts >= FRAME_MS + CONFIG.min_hold_ms


def test_a_short_blip_emits_nothing() -> None:
    scene = Scene()
    scene.show(200, PALM)
    scene.nothing(1000)
    assert scene.events == []


def test_flicker_between_labels_emits_nothing() -> None:
    scene = Scene()
    for _ in range(20):
        scene.show(100, PALM)
        scene.show(100, FIST)
    assert scene.events == []


def test_low_confidence_never_starts() -> None:
    scene = Scene()
    scene.show(1000, Seen("right", "open_palm", confidence=0.5))
    assert scene.events == []


def test_none_label_never_starts() -> None:
    scene = Scene()
    scene.show(1000, Seen("right", "none", confidence=0.99))
    assert scene.events == []


def test_hand_leaving_ends_the_hold() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.nothing(300)
    assert scene.phases() == [("start", "right", "open_palm"), ("end", "right", "open_palm")]


def test_end_waits_for_the_release_time() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.nothing(150)
    assert len(scene.events) == 1


def test_a_short_dropout_keeps_the_hold() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.nothing(100)
    scene.show(1000, PALM)
    assert len(scene.events) == 1


def test_low_confidence_frames_keep_a_started_hold() -> None:
    scene = Scene()
    scene.show(500, PALM)
    scene.show(1000, Seen("right", "open_palm", confidence=0.3))
    assert len(scene.events) == 1


def test_end_reports_how_long_it_was_held() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.nothing(300)
    start, end = scene.events
    assert isinstance(end, GestureEnd) and end.held_ms == scene.ts - start.ts - 9 * FRAME_MS


def test_switching_gesture_ends_one_and_starts_the_other() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.show(1000, FIST)
    assert scene.phases() == [
        ("start", "right", "open_palm"),
        ("end", "right", "open_palm"),
        ("start", "right", "closed_fist"),
    ]


def test_cooldown_holds_back_a_quick_repeat() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.nothing(300)
    scene.show(600, PALM)
    assert len(scene.events) == 2


def test_repeat_starts_once_the_cooldown_is_over() -> None:
    scene = Scene()
    scene.show(1000, PALM)
    scene.nothing(300)
    scene.show(1000, PALM)
    assert len(scene.events) == 3


def test_two_hands_are_independent() -> None:
    scene = Scene()
    scene.show(500, PALM)
    scene.show(500, PALM, Seen("left", "thumb_up"))
    scene.show(500, Seen("left", "thumb_up"))
    assert scene.phases() == [
        ("start", "right", "open_palm"),
        ("start", "left", "thumb_up"),
        ("end", "right", "open_palm"),
    ]


def test_holds_lists_what_is_held() -> None:
    scene = Scene()
    scene.show(500, PALM, Seen("left", "victory"))
    assert scene.stabilizer.holds() == {"left": "victory", "right": "open_palm"}


def test_close_ends_open_holds() -> None:
    scene = Scene()
    scene.show(500, PALM)
    ended = scene.stabilizer.close(scene.ts)
    assert [(event.hand, event.name) for event in ended] == [("right", "open_palm")]
