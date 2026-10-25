from gestures.fps import FpsMeter


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_zero_until_two_frames() -> None:
    clock = FakeClock()
    meter = FpsMeter(clock)
    assert meter.tick() == 0.0


def test_steady_rate() -> None:
    clock = FakeClock()
    meter = FpsMeter(clock)
    for _ in range(10):
        meter.tick()
        clock.now += 1 / 30
    assert abs(meter.tick() - 30) < 0.01


def test_smooths_a_single_slow_frame() -> None:
    clock = FakeClock()
    meter = FpsMeter(clock)
    for _ in range(10):
        meter.tick()
        clock.now += 1 / 30
    clock.now += 0.5  # one hiccup
    assert meter.tick() > 10  # unsmoothed would read ~1.9
