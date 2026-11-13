// src/cmd.c: the #bugreport command and binding keys from the command menu.

export default {
  file: "src/cmd.c",
  patches: [
    {
      why: "#bugreport is an extended command; dobugreport() (nhjs_host.c) says it cannot send a report.",
      edits: [
        {
          find: "#endif /* DUMB */\n",
          replace: "#endif /* DUMB */\nextern int dobugreport(void);\n",
        },
        {
          find: String.raw`#ifdef CRASHREPORT
    { '\0',   "bugreport", "file a bug report",
              dobugreport, GENERALCMD | NOFUZZERCMD, NULL },
#endif
`,
          replace: String.raw`    { '\0',   "bugreport", "file a bug report",
              dobugreport, GENERALCMD | NOFUZZERCMD, NULL },
`,
        },
      ],
    },
    {
      why: 'Binding a key from the command menu fails with "Key binding failed?!".',
      edits: [
        {
          find: "        struct Cmd_bind *prevcmd;\n        char cmdstr[BUFSZ];\n",
          replace: String.raw`        struct Cmd_bind *prevcmd;
        char cmdstr[BUFSZ];
        /* cmdstr starts out holding a non-empty string, so the Strcat()
           below builds a name that is no command and the binding is
           rejected ("Key binding failed?!"). */
        cmdstr[0] = '\377';
        cmdstr[1] = '\0';
`,
        },
      ],
    },
  ],
};
