# The recording environment

Every session is a recording of NetHack 5.0 running in one specific
environment. Some of what NetHack printed came from that environment
rather than from the game: a file path, a timezone, a terminal type.
To match the recorded screens, your port has to print the same
strings. Hard-coding them is fine. This page lists the environment
the recorder ran in.

## Filesystem

`HOME` was set to the recording harness's working directory:

    /Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results

Before each launch, the harness wrote the session's `nethackrc` field
to `$HOME/.nethackrc`. NetHack therefore reports its config file as

    /Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc

and prints that path wherever it mentions the config file location,
such as the options help pager. The terminal wraps it at column 80,
and the wrap point depends on the string's exact length, so print it
verbatim.

## Terminal

`TERM` was `xterm-256color`, so NetHack believed it had a
256-color terminal. This enables color behavior (for example, symset
wall colors) that a plainer terminal type would turn off.

The screen is 80 columns by 24 rows. Scoring compares the escape
stream your port emits after rendering it into that grid.

## Clock and timezone

`TZ` was `America/New_York`. Moon phase, Friday the 13th, and
day-of-year calculations all used that zone.

Each session's `datetime` field pins the wall clock at launch. The
recorder patches in `nethack-c/patches/` show how.

## Everything else

The recorder build is defined by `nethack-c/build-recorder.sh` and
the patches next to it. It was compiled on macOS, so where behavior
depends on the C library (regex compilation, printf corner cases,
tty input modes), the recordings reflect the Darwin libc.

If a screen seems to depend on something not listed here, open an
issue. Confirmed additions go on this page.
