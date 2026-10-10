/** Exit code by which the app asks the supervisor to start it again. */
export const RESTART_EXIT_CODE = 75;

/** Set by the supervisor on every start after the first, so the UI isn't opened in a new tab each time. */
export const RESTARTED_ENV = "VO_RESTARTED";
