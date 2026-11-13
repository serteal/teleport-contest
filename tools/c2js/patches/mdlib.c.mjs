// src/mdlib.c: the build description shown by #version and the options help.
//
// makedefs compiles this file too; the changes apply to the game only (NHJS_PORT, defined by
// tools/nh2js when it parses the game).

export default {
  file: "src/mdlib.c",
  patches: [
    {
      why: "#version lists terminfo, compression, stack traces and crash reports, not the ANSI terminal.",
      edits: [
        {
          find: "#ifdef ANSI_DEFAULT\n    \"ANSI default terminal\",",
          replace: "#if defined(ANSI_DEFAULT) && !defined(NHJS_PORT)\n    \"ANSI default terminal\",",
        },
        {
          find: "#ifdef COMPRESS\n    \"data file compression\",",
          replace: "#if defined(COMPRESS) || defined(NHJS_PORT)\n    \"data file compression\",",
        },
        {
          find: String.raw`#ifdef DEV_RANDOM
    /* include which specific one */
    "strong PRNG seed from " DEV_RANDOM,
#else`,
          replace: String.raw`#if defined(NHJS_PORT)
    "strong PRNG seed from /dev/random",
#elif defined(DEV_RANDOM)
    /* include which specific one */
    "strong PRNG seed from " DEV_RANDOM,
#else`,
        },
        {
          find: String.raw`#ifdef TTY_GRAPHICS
#ifdef TERMINFO
    "terminal info library",
#else
#if defined(TERMLIB) || (!defined(MICRO) && !defined(WIN32))
    "terminal capability library",
#endif
#endif
#endif /*TTY_GRAPHICS*/`,
          replace: String.raw`#ifdef TTY_GRAPHICS
#ifdef NHJS_PORT
    "terminal info library",
#else
#ifdef TERMINFO
    "terminal info library",
#else
#if defined(TERMLIB) || (!defined(MICRO) && !defined(WIN32))
    "terminal capability library",
#endif
#endif
#endif
#endif /*TTY_GRAPHICS*/`,
        },
        {
          find: "#ifdef PANICTRACE\n    \"show stack trace on error\",",
          replace: "#if defined(PANICTRACE) || defined(NHJS_PORT)\n    \"show stack trace on error\",",
        },
        {
          find: "#ifdef CRASHREPORT\n    \"launch browser to report issues\",",
          replace: "#if defined(CRASHREPORT) || defined(NHJS_PORT)\n    \"launch browser to report issues\",",
        },
      ],
    },
    {
      why: "The data model shown is I32LP64 (64-bit long and pointers).",
      edits: [
        {
          find: "    Strcat(strcpy(buf, datamodel(0)), \" data model,\");\n",
          replace: String.raw`#ifdef NHJS_PORT
    Strcat(strcpy(buf, "I32LP64"), " data model,");
#else
    Strcat(strcpy(buf, datamodel(0)), " data model,");
#endif
`,
        },
      ],
    },
  ],
};
