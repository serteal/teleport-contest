// win/tty/termcap.c: the terminal image (NOMUX capture) handed to the session driver.

const longCaptureLayout = String.raw`static int nomux_seq = 0;
int nomux_anim_id = 0;

/* the capture buffer as it is laid out for long captures, see
   nomux_ref_overflow_state() */
#define NOMUX_REF_RAW_ACTIVE 6144
#define NOMUX_REF_RAW_ROW 6148
#define NOMUX_REF_RAW_COL 6152
#define NOMUX_REF_STDOUT_BUF 6448
#define NOMUX_REF_STDOUT_BUFSIZ 1024

static void nomux_ref_overflow_state(const char *, size_t);
static void nomux_ref_overflow_payload(char *, size_t, const char *, int,
                                       int);
`;

const longCaptureFunctions = String.raw`    *cx = ttyDisplay ? ttyDisplay->curx : 0;
    *cy = ttyDisplay ? ttyDisplay->cury : 0;
}

/*
 * Long captures.  A capture is handled as if it were written into a
 * 6,144-byte buffer (nomux_out[24 * 256]) followed in memory by
 *   offset 6144  nomux_raw_active   6148  nomux_raw_row
 *          6152  nomux_raw_col      6448  stdout's buffer (BUFSIZ 1024)
 * (nothing in between is reached by a capture).  A capture that runs past
 * the end of the buffer overwrites them for the rest of the process: its
 * bytes and its terminating NUL replace the bytes of the three ints they
 * cover (little-endian).  Once nomux_raw_active is non-zero the cursor
 * comes from nomux_raw_col/nomux_raw_row and raw_print output goes on from
 * there without clearing the screen.  The marker is then written into
 * stdout's buffer with the start of the capture after it, so a capture
 * longer than 6,448 bytes carries them from that offset.
 * NHJS_UNBOUNDED_CAPTURE (interactive play) keeps the whole capture.
 */
static int
nomux_ref_overflow_enabled(void)
{
    static int cached = -1;

    if (cached < 0) {
        const char *ev = getenv("NHJS_UNBOUNDED_CAPTURE");

        cached = (ev && *ev && ev[0] != '0') ? 0 : 1;
    }
    return cached;
}

static int
nomux_ref_overlay(int value, size_t offset, const char *scr, size_t len)
{
    unsigned int u = (unsigned int) value;
    int i;

    for (i = 0; i < 4; i++) {
        size_t at = offset + (size_t) i;
        unsigned int mask = 0xffU << (8 * i);

        if (at < len)
            u = (u & ~mask)
                | ((unsigned int) (unsigned char) scr[at] << (8 * i));
        else if (at == len)
            u &= ~mask;
    }
    return (int) u;
}

static void
nomux_ref_overflow_state(const char *scr, size_t len)
{
    if (!nomux_ref_overflow_enabled())
        return;
    nomux_raw_active = nomux_ref_overlay(nomux_raw_active,
                                         NOMUX_REF_RAW_ACTIVE, scr, len);
    nomux_raw_row = nomux_ref_overlay(nomux_raw_row, NOMUX_REF_RAW_ROW,
                                      scr, len);
    nomux_raw_col = nomux_ref_overlay(nomux_raw_col, NOMUX_REF_RAW_COL,
                                      scr, len);
}

static void
nomux_ref_overflow_payload(char *scr, size_t len, const char *kind, int cx,
                           int cy)
{
    char hdr[BUFSZ];
    size_t n, i, end;

    if (!nomux_ref_overflow_enabled())
        return;
    n = (size_t) snprintf(hdr, sizeof hdr,
                 "\x1b]7777;KIND=%s;SEQ=%d;ANIM=%d;CX=%d;CY=%d;LEN=%zu\x07",
                 kind, nomux_seq, nomux_anim_id, cx, cy, len);
    end = NOMUX_REF_STDOUT_BUF + NOMUX_REF_STDOUT_BUFSIZ;
    if (end > len)
        end = len;
    for (i = NOMUX_REF_STDOUT_BUF; i < end; i++) {
        size_t k = i - NOMUX_REF_STDOUT_BUF;

        scr[i] = (k < n) ? hdr[k] : scr[k - n];
    }
}
#endif /* NOMUX_CAPTURE */`;

export default {
  file: "win/tty/termcap.c",
  patches: [
    {
      why: "Every capture (each key read and each animation frame) goes to the session driver.",
      edits: [
        {
          find: String.raw`nomux_emit_marker(const char *kind)
{
    if (!nomux_markers_enabled())
        return;

    {
        char *scr = nomux_capture_screen();
        int cx, cy;
        size_t scr_len = scr ? strlen(scr) : 0;
        nomux_get_cursor(&cx, &cy);
`,
          replace: String.raw`nomux_emit_marker(const char *kind)
{
    extern void nhjs_tty_capture_boundary(const char *, int, int, int, int,
                                          const char *);
    char *scr = nomux_capture_screen();
    int cx, cy;
    size_t scr_len = scr ? strlen(scr) : 0;
    nomux_get_cursor(&cx, &cy);
    nhjs_tty_capture_boundary(kind, nomux_seq, nomux_anim_id, cx, cy, scr);
    if (getenv("NHJS_SUPPRESS_NOMUX_MARKERS"))
        return;
    if (!nomux_markers_enabled())
        return;

    {
`,
        },
      ],
    },
    {
      why: "The capture buffer holds any 24x80 screen (every cell may change colour and charset).",
      edits: [
        {
          find: "static char nomux_out[24 * 256];",
          replace: "static char nomux_out[24 * 80 * 32];",
        },
      ],
    },
    {
      why: "A capture longer than 6,144 bytes changes the cursor and later captures (nomux_ref_overflow_state()).",
      edits: [
        { find: "static int nomux_seq = 0;\nint nomux_anim_id = 0;\n", replace: longCaptureLayout },
        {
          find: String.raw`    size_t scr_len = scr ? strlen(scr) : 0;
    nomux_get_cursor(&cx, &cy);
    nhjs_tty_capture_boundary(`,
          replace: String.raw`    size_t scr_len = scr ? strlen(scr) : 0;
    if (scr_len >= NOMUX_REF_RAW_ACTIVE)
        nomux_ref_overflow_state(scr, scr_len);
    nomux_get_cursor(&cx, &cy);
    if (scr_len > NOMUX_REF_STDOUT_BUF)
        nomux_ref_overflow_payload(scr, scr_len, kind, cx, cy);
    nhjs_tty_capture_boundary(`,
        },
        {
          find: String.raw`    *cx = ttyDisplay ? ttyDisplay->curx : 0;
    *cy = ttyDisplay ? ttyDisplay->cury : 0;
}
#endif /* NOMUX_CAPTURE */`,
          replace: longCaptureFunctions,
        },
      ],
    },
    {
      why: "Blink stays blink when the terminal has no blink sequence (it does not become bold).",
      edits: [
        {
          find: String.raw`    if ((msk & HL_BLINK) && (!MB || !*MB)) {
        msk |= HL_BOLD;
        msk &= ~HL_BLINK;
    }
`,
          replace: "    /* blink is kept as blink, which the capture does not show */\n",
        },
      ],
    },
    {
      why: "The capture's attributes and colour change only when an escape sequence is written.",
      edits: [
        {
          find: String.raw`    if (attr) {
#ifdef NOMUX_CAPTURE
        nomux_set_attr(attr);
#endif
        const char *astr = s_atr2str(attr);

        if (astr && *astr)
            xputs(astr);
    }`,
          replace: String.raw`    if (attr) {
        const char *astr = s_atr2str(attr);

        if (astr && *astr) {
#ifdef NOMUX_CAPTURE
            nomux_set_attr(attr);
#endif
            xputs(astr);
        }
    }`,
        },
        {
          find: String.raw`    if (attr) {
#ifdef NOMUX_CAPTURE
        nomux_end_attr();
#endif
        const char *astr = e_atr2str(attr);

        if (astr && *astr)
            xputs(astr);
    }`,
          replace: String.raw`    if (attr) {
        const char *astr = e_atr2str(attr);

        if (astr && *astr) {
#ifdef NOMUX_CAPTURE
            nomux_end_attr();
#endif
            xputs(astr);
        }
    }`,
        },
        {
          find: String.raw`term_end_color(void)
{
    xputs(nh_HE);
#ifdef NOMUX_CAPTURE
    nomux_end_fg();
    nomux_end_attr();
#endif
}`,
          replace: String.raw`term_end_color(void)
{
    if (nh_HE && *nh_HE) {
        xputs(nh_HE);
#ifdef NOMUX_CAPTURE
        nomux_end_fg();
        nomux_end_attr();
#endif
    }
}`,
        },
        {
          find: String.raw`term_start_color(int color)
{
#ifdef NOMUX_CAPTURE
    nomux_set_fg(color);
#endif
    if (color == NO_COLOR)
        xputs(nh_HE); /* inline term_end_color() */
    else if (color < CLR_MAX && hilites[color] && *hilites[color])
        xputs(hilites[color]);
}`,
          replace: String.raw`term_start_color(int color)
{
    if (color == NO_COLOR) {
        if (nh_HE && *nh_HE) {
            xputs(nh_HE); /* inline term_end_color() */
#ifdef NOMUX_CAPTURE
            nomux_end_fg();
            nomux_end_attr();
#endif
        }
    } else if (color < CLR_MAX && hilites[color] && *hilites[color]) {
#ifdef NOMUX_CAPTURE
        nomux_set_fg(color);
#endif
        xputs(hilites[color]);
    }
}`,
        },
      ],
    },
    {
      why: "The terminal reports 256 colours, while drawing uses the built-in ANSI colour sequences.",
      edits: [
        {
          find: "    int c;\n#ifdef TOS\n",
          replace: "    int c;\n    iflags.colorcount = 256; /* the terminal's colour count */\n#ifdef TOS\n",
        },
      ],
    },
  ],
};
