// win/tty/wintty.c: reading keys and clearing the terminal image.

export default {
  file: "win/tty/wintty.c",
  patches: [
    {
      why: "Every key, including one read while another is being read, comes from tgetch().",
      edits: [
        {
          find: String.raw`#ifdef UNIX
        i = (program_state.getting_char == 1)
              ? tgetch()
              : ((read(fileno(stdin), (genericptr_t) &nestbuf, 1) == 1)
                 ? (int) nestbuf : EOF);
#else
        i = tgetch();
#endif
`,
          replace: "        i = tgetch(); /* the session's input; there is no stdin */\n",
        },
      ],
    },
    {
      why: "Clearing the whole screen for the message window also clears the capture.",
      edits: [
        {
          find: String.raw`            ttyDisplay->toplin = TOPLINE_EMPTY;
        } else {
            if (WIN_MESSAGE != WIN_ERR)
                tty_clear_nhwindow(WIN_MESSAGE);
        }`,
          replace: String.raw`            ttyDisplay->toplin = TOPLINE_EMPTY;
            nomux_clear_screen();
        } else {
            if (WIN_MESSAGE != WIN_ERR)
                tty_clear_nhwindow(WIN_MESSAGE);
        }`,
        },
      ],
    },
    {
      why: "A full-screen text window clears the capture before its first page and each next page.",
      edits: [
        {
          find: "    for (n = 0, i = 0; i < cw->maxrow; i++) {\n        HUPSKIP();",
          replace: String.raw`    if (cw->type == NHW_TEXT && !cw->offx) {
        /* the window covers the whole screen */
        nomux_clear_screen();
    }

    for (n = 0, i = 0; i < cw->maxrow; i++) {
        HUPSKIP();`,
        },
        {
          find: "            } else\n                term_clear_screen();\n            n = 0;",
          replace: String.raw`            } else
                term_clear_screen();
            if (cw->type == NHW_TEXT && !cw->offx)
                nomux_clear_screen();
            n = 0;`,
        },
      ],
    },
  ],
};
