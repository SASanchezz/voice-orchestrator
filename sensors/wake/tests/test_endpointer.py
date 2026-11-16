from wake.endpointer import NO_SPEECH, SPEECH_END, EndpointConfig, Endpointer

CONFIG = EndpointConfig()
SPEECH = 0.9
QUIET = 0.1


def frames_for(ms: int) -> int:
    """Enough whole frames to last `ms`."""
    return -(-ms // CONFIG.frame_ms)


def verdicts(probabilities: list[float]) -> list[str | None]:
    endpointer = Endpointer(CONFIG)
    return [endpointer.step(probability) for probability in probabilities]


def grace() -> list[float]:
    return [QUIET] * frames_for(CONFIG.grace_ms)


def words() -> list[float]:
    return [SPEECH] * frames_for(1000)


def test_speech_then_silence_ends_the_message() -> None:
    probabilities = grace() + words() + [QUIET] * frames_for(CONFIG.end_silence_ms)
    assert verdicts(probabilities)[-1] == SPEECH_END


def test_a_short_pause_inside_the_message_does_not_end_it() -> None:
    probabilities = grace() + words() + [QUIET] * (frames_for(CONFIG.end_silence_ms) - 1)
    assert SPEECH_END not in verdicts(probabilities)


def test_nothing_said_gives_up_after_the_wait() -> None:
    assert verdicts([QUIET] * frames_for(CONFIG.no_speech_ms))[-1] == NO_SPEECH


def test_the_wake_words_tail_in_the_grace_time_is_not_speech() -> None:
    probabilities = [SPEECH] * frames_for(CONFIG.grace_ms) + [QUIET] * frames_for(CONFIG.no_speech_ms)
    assert NO_SPEECH in verdicts(probabilities)


def test_a_cough_shorter_than_words_is_not_speech() -> None:
    cough = [SPEECH] * (frames_for(CONFIG.min_speech_ms) - 1)
    probabilities = grace() + cough + [QUIET] * frames_for(CONFIG.end_silence_ms)
    assert SPEECH_END not in verdicts(probabilities)


def test_endless_speech_ends_at_the_limit() -> None:
    assert verdicts([SPEECH] * frames_for(CONFIG.max_ms))[-1] == SPEECH_END


def test_start_forgets_the_previous_message() -> None:
    endpointer = Endpointer(CONFIG)
    for probability in grace() + words():
        endpointer.step(probability)
    endpointer.start()
    results = [endpointer.step(QUIET) for _ in range(frames_for(CONFIG.end_silence_ms) + len(grace()))]
    assert SPEECH_END not in results
