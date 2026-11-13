// include/unixconf.h: the terminal and where keys come from.

export default {
  file: "include/unixconf.h",
  patches: [
    {
      why: "Terminal control sequences are NetHack's built-in ANSI ones, not terminfo's.",
      edits: [
        {
          find: "#define TERMINFO       /* uses terminfo rather than termcap */",
          replace: "/* #undef TERMINFO -- the built-in ANSI terminal sequences are used */",
        },
      ],
    },
    {
      why: "Keys are read from the session's input (nhjs_tgetch()) instead of stdin.",
      edits: [
        {
          find: "#define tgetch getchar",
          replace: String.raw`extern int nhjs_tgetch(void);
#define tgetch nhjs_tgetch /* the next key of the session's input */`,
        },
      ],
    },
  ],
};
