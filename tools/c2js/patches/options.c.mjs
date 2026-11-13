// src/options.c: the crash-report options.

export default {
  file: "src/options.c",
  patches: [
    {
      why: "The crash_email, crash_name and crash_urlmax options can be set (see include/optlist.h).",
      edits: [
        {
          find: "#ifdef CRASHREPORT\nstaticfn int\noptfn_crash_email(",
          replace: "staticfn int\noptfn_crash_email(",
        },
        { find: "\n#endif /* CRASHREPORT */\n", replace: "\n" },
      ],
    },
  ],
};
