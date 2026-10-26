from hands import open_hand, seen

from gestures.events import GestureEvent, GestureStart, GestureTap
from gestures.stabilizer import Stabilizer, StabilizerConfig
from gestures.swipes import SwipeConfig, SwipeDetector
from gestures.tracker import GestureTracker

FRAME_MS = 33


def track(*xs: float) -> list[GestureEvent]:
    """An open palm at each x in turn, one frame every FRAME_MS."""
    tracker = GestureTracker(Stabilizer(StabilizerConfig(min_hold_ms=100)), SwipeDetector(SwipeConfig()))
    events: list[GestureEvent] = []
    for frame, x in enumerate(xs, start=1):
        events += tracker.update(frame * FRAME_MS, [seen(open_hand(x))])
    return events


def test_a_still_open_palm_starts() -> None:
    assert [type(event) for event in track(*[0.5] * 10)] == [GestureStart]


def test_a_swipe_with_an_open_palm_only_swipes() -> None:
    swipe_and_rest = [0.3 + 0.05 * step for step in range(9)] + [0.7] * 10
    assert [type(event) for event in track(*swipe_and_rest)] == [GestureTap]
