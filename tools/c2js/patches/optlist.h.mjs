// include/optlist.h: the crash-report options.
//
// makedefs compiles this header too; the change applies to the game only (NHJS_PORT, defined
// by tools/nh2js when it parses the game).

export default {
  file: "include/optlist.h",
  patches: [
    {
      why: "The options menu lists crash_email, crash_name and crash_urlmax.",
      edits: [
        {
          find: "#ifdef CRASHREPORT\n    NHOPTC(crash_email",
          replace: "#if defined(CRASHREPORT) || defined(NHJS_PORT)\n    NHOPTC(crash_email",
        },
      ],
    },
  ],
};
