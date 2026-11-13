/* NetHack 5.0	termcap.c	$NHDT-Date: 1701946349 2023/12/07 10:52:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.60 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/* leave this undefined; it produces bad screen output with rxvt-unicode */
/*#define DECgraphicsOptimization*/

/* (see tcap.h) -- nh_CM, nh_ND, nh_CD, nh_HI,nh_HE, nh_US,nh_UE, ul_hack */
export const tc_lcl_data = static_struct("tc_lcl_data", struct_tc_lcl_data, { tc_CM: 0, tc_ND: 0, tc_CD: 0, tc_HI: 0, tc_HE: 0, tc_US: 0, tc_UE: 0, tc_ul_hack: FALSE });

const nh_VI = static_var("nh_VI", ptr_to(char), 0); /* cursor_invisible */
const nh_VE = static_var("nh_VE", ptr_to(char), 0); /* cursor_normal */
/*static char *nh_VS = (char *) 0;*/ /* cursor_visible (highlighted cursor) */
const nh_Ic = static_var("nh_Ic", ptr_to(char), 0); /* initialize_color */

const HO = static_var("HO", ptr_to(char)); const CL = static_var("CL", ptr_to(char)); const CE = static_var("CE", ptr_to(char)); const UP = static_var("UP", ptr_to(char)); const XD = static_var("XD", ptr_to(char)); const BC = static_var("BC", ptr_to(char)); const SO = static_var("SO", ptr_to(char)); const SE = static_var("SE", ptr_to(char)); const TI = static_var("TI", ptr_to(char)); const TE = static_var("TE", ptr_to(char));
const VS = static_var("VS", ptr_to(char)); const VE = static_var("VE", ptr_to(char));
const ME = static_var("ME", ptr_to(char)); const MR = static_var("MR", ptr_to(char)); const MB = static_var("MB", ptr_to(char)); const MH = static_var("MH", ptr_to(char)); const MD = static_var("MD", ptr_to(char));
const ZH = static_var("ZH", ptr_to(char)); const ZR = static_var("ZR", ptr_to(char));

global_scalar("dynamic_HIHE", schar, FALSE);
const SG = static_var("SG", int);
const PC = static_var("PC", char, ord('\0'));
const tbuf = static_array("tbuf", char, 512);

export const hilites = static_array("hilites", ptr_to(char), CLR_MAX); /* terminal escapes for the various colors */

const KS = static_var("KS", ptr_to(char), 0); const KE = static_var("KE", ptr_to(char), 0); /* keypad sequences */
const nullstr = init_string(static_array("nullstr", char, sizeof_string("")), _(""), true);

/* these don't need to be part of 'struct instance_globals g' */
const tty_standout_on = static_array("tty_standout_on", char, 16); const tty_standout_off = static_array("tty_standout_off", char, 16);

export function term_startup(wid, hgt) { /* void */
    const $frame = stack_frame(); try {
    let term;
    let tptr;
    let tbufptr = stack_var(ptr_to(char)), pc;
    let i;

        term = getenv(_("TERM"));

    if (!term)

    /* #ifdef TOS: not in this build */

    {
        HO[0] = nhStr(_("\x1b[H"));
        /*              nh_CD = nhStr("\033[J"); */
        CE[0] = nhStr(_("\x1b[K")); /* the ANSI termcap */

        tc_lcl_data.tc_CM = nhStr(_("\x1b[%i%d;%dH"));

        UP[0] = nhStr(_("\x1b[A"));
        tc_lcl_data.tc_ND = nhStr(_("\x1b[C"));
        XD[0] = nhStr(_("\x1b[B"));

        BC[0] = nhStr(_("\x1b[D"));

        tc_lcl_data.tc_HI = SO[0] = nhStr(_("\x1b[1m"));
        tc_lcl_data.tc_US = nhStr(_("\x1b[4m"));
        MR[0] = nhStr(_("\x1b[7m"));
        TI[0] = tc_lcl_data.tc_HE = ME[0] = SE[0] = tc_lcl_data.tc_UE = nhStr(_("\x1b[0m"));
        /* strictly, SE should be 2, and nh_UE should be 24,
           but we can't trust all ANSI emulators to be
           that complete.  -3. */

        gt.tc_gbl_data.tc_AS = nhStr(_("\x0e"));
        gt.tc_gbl_data.tc_AE = nhStr(_("\x0f"));

        TE[0] = VS[0] = VE[0] = nullstr;
        init_hilite();
        wid[0] = CO();
        hgt[0] = LI();
        CL[0] = nhStr(_("\x1b[2J")); /* last thing set */
        return;
    }

    tptr = addr_of(alloc(1024));

    tbufptr[0] = tbuf;
    if (!strncmp(term, _("5620"), 4))
        flags.null = FALSE; /* this should be a termcap flag */
    if (tgetent(tptr, term) < 1) {
        let buf = stack_array(char, BUFSZ);
        strncpy(buf, term,
                       (BUFSZ - 1) - sizeof_string("Unknown terminal type: .  "));
        chars[buf + (BUFSZ - 1)] = ord('\0');
        error(_("Unknown terminal type: %s."), term);
    }
    if ((pc = tgetstr(nhStr(_("pc")), tbufptr)) != 0)
        PC[0] = chars[pc];

    if (!(BC[0] = tgetstr(nhStr(_("le")), tbufptr))) { /* both termcap and terminfo use le */
        if (!(BC[0] = tgetstr(nhStr(_("bc")), tbufptr))) { /* termcap also uses bc/bs */
            if (!tgetflag(nhStr(_("bs"))))
                error(_("Terminal must backspace."));

            BC[0] = tbufptr[0];
            tbufptr[0] += 2;
            chars[BC[0]] = ord('\b');
        }
    }

    HO[0] = tgetstr(nhStr(_("ho")), tbufptr);

    /*
     * LI and CO are set in ioctl.c via a TIOCGWINSZ if available.  If
     * the kernel has values for either we should use them rather than
     * the values from TERMCAP ...
     */

    if (!CO())
        gt.tc_gbl_data.tc_CO = tgetnum(nhStr(_("co")));
    if (!LI())
        gt.tc_gbl_data.tc_LI = tgetnum(nhStr(_("li")));
    /* #else (#ifndef MICRO): not in this build */

    if (CO() < COLNO || LI() < ROWNO + 3)
        setclipped();

    tc_lcl_data.tc_ND = tgetstr(nhStr(_("nd")), tbufptr); /* move cursor right 1 column */
    if (tgetflag(nhStr(_("os")))) /* term can overstrike */
        error(_("NetHack can't have OS."));
    if (tgetflag(nhStr(_("ul")))) /* underline by overstrike w/ underscore */
        tc_lcl_data.tc_ul_hack = TRUE;
    CE[0] = tgetstr(nhStr(_("ce")), tbufptr); /* clear line from cursor to eol */
    UP[0] = tgetstr(nhStr(_("up")), tbufptr); /* move cursor up 1 line */
    /* It seems that xd is no longer supported, and we should use
       a linefeed instead; unfortunately this requires resetting
       CRMOD, and many output routines will have to be modified
       slightly. Let's leave that till the next release. */
    XD[0] = tgetstr(nhStr(_("xd")), tbufptr);
    /* not:             XD = Tgetstr("do"); */
    if (!(tc_lcl_data.tc_CM = tgetstr(nhStr(_("cm")), tbufptr))) { /* cm: move cursor */
        if (!UP[0] && !HO[0])
            error(_("NetHack needs CM or UP or HO."));
        tty_raw_print(_("Playing NetHack on terminals without CM is suspect."));
        tty_wait_synch();
    }
    SO[0] = tgetstr(nhStr(_("so")), tbufptr); /* standout start */
    SE[0] = tgetstr(nhStr(_("se")), tbufptr); /* standout end */
    tc_lcl_data.tc_US = tgetstr(nhStr(_("us")), tbufptr); /* underline start */
    tc_lcl_data.tc_UE = tgetstr(nhStr(_("ue")), tbufptr); /* underline end */
    ZH[0] = tgetstr(nhStr(_("ZH")), tbufptr); /* italic start */
    ZR[0] = tgetstr(nhStr(_("ZR")), tbufptr); /* italic end */
    SG[0] = tgetnum(nhStr(_("sg"))); /* -1: not fnd; else # of spaces left by so */
    if (!SO[0] || !SE[0] || (SG[0] > 0))
        SO[0] = SE[0] = tc_lcl_data.tc_US = tc_lcl_data.tc_UE = nullstr;
    TI[0] = tgetstr(nhStr(_("ti")), tbufptr); /* nonconsequential cursor movement start */
    TE[0] = tgetstr(nhStr(_("te")), tbufptr); /* nonconsequential cursor movement end */
    VS[0] = VE[0] = nullstr;

    KS[0] = tgetstr(nhStr(_("ks")), tbufptr); /* keypad start (special mode) */
    KE[0] = tgetstr(nhStr(_("ke")), tbufptr); /* keypad end (ordinary mode [ie, digits]) */
    MR[0] = tgetstr(nhStr(_("mr")), tbufptr); /* reverse */
    MB[0] = tgetstr(nhStr(_("mb")), tbufptr); /* blink */
    MD[0] = tgetstr(nhStr(_("md")), tbufptr); /* boldface */
    if (!SO[0])
        SO[0] = MD[0];
    MH[0] = tgetstr(nhStr(_("mh")), tbufptr); /* dim */
    ME[0] = tgetstr(nhStr(_("me")), tbufptr); /* turn off all attributes */
    if (!ME[0])
        ME[0] = SE[0] ? SE[0] : nullstr; /* default to SE value */

    nh_VI[0] = tgetstr(nhStr(_("vi")), tbufptr);
    nh_VE[0] = tgetstr(nhStr(_("ve")), tbufptr);
    /*nh_VS = Tgetstr(nhStr("vs"));*/
    if (!nh_VI[0] || !nh_VE[0] /*|| !nh_VS*/ )
        nh_VI[0] = nh_VE[0] = /*nh_VS =*/ 0;

    nh_Ic[0] = tgetstr(nhStr(_("Ic")), tbufptr);

    /* Get rid of padding numbers for nh_HI and nh_HE.  Hope they
     * aren't really needed!!!  nh_HI and nh_HE are outputted to the
     * pager as a string - so how can you send it NULs???
     *  -jsb
     */
    for (i = 0; digit(chars[SO[0] + i]); ++i)
        continue;
    tc_lcl_data.tc_HI = dupstr(SO[0] + i);
    for (i = 0; digit(chars[ME[0] + i]); ++i)
        continue;
    tc_lcl_data.tc_HE = dupstr(ME[0] + i);
    dynamic_HIHE = TRUE;

    gt.tc_gbl_data.tc_AS = tgetstr(nhStr(_("as")), tbufptr); /* alt charset start */
    gt.tc_gbl_data.tc_AE = tgetstr(nhStr(_("ae")), tbufptr); /* alt charset end */
    tc_lcl_data.tc_CD = tgetstr(nhStr(_("cd")), tbufptr); /* clear lines from cursor and down */

    init_hilite();

    wid[0] = CO();
    hgt[0] = LI();
    /* cl: clear screen, set cursor to upper left */
    if (!(CL[0] = tgetstr(nhStr(_("cl")), tbufptr))) /* last thing set */
        error(_("NetHack needs CL."));
    if ((tbufptr[0] - tbuf) > sizeof(array_of(char, 512)))
        error(_("TERMCAP entry too big...\n"));
    free(tptr);

    /* keep static copies of these so that raw_print_bold() will work
       after exit_nhwindows(); if the sequences are too long, then bold
       won't work after that--it will be rendered as ordinary text */
    if (nh_HI() && strlen(nh_HI()) < sizeof(array_of(char, 16)))
        strcpy(tty_standout_on, nh_HI());
    if (nh_HE() && strlen(nh_HE()) < sizeof(array_of(char, 16)))
        strcpy(tty_standout_off, nh_HE());
    } finally { stack_pop($frame); }
}

/* note: at present, this routine is not part of the formal window interface
 */
/* deallocate resources prior to final termination */
export function term_shutdown() { /* void */
    /* we only attempt to clean up a few individual termcap variables */

    kill_hilite();

    if (dynamic_HIHE) {
        free(nh_HI()), tc_lcl_data.tc_HI = 0;
        free(nh_HE()), tc_lcl_data.tc_HE = 0;
        dynamic_HIHE = FALSE;
    }

    return;
}

export function tty_number_pad(state) { /* void */
    switch (state) {
    case -1: /* activate keypad mode (escape sequences) */
        if (KS[0] && chars[KS[0]])
            xputs(KS[0]);
        break;
    case 1: /* activate numeric mode for keypad (digits) */
        if (KE[0] && chars[KE[0]])
            xputs(KE[0]);
        break;
    case 0: /* don't need to do anything--leave terminal as-is */
    default:
        break;
    }
}

 /* defined in symbols.c */

/*
   We call this routine whenever DECgraphics mode is enabled, even if it
   has been previously set, in case the user manages to reset the fonts.
   The actual termcap fixup only needs to be done once, but we can't
   call xputs() from the option setting or graphics assigning routines,
   so this is a convenient hook.
 */
function tty_decgraphics_termcap_fixup() { /* void */
    let ctrlN = init_string(static_array("tty_decgraphics_termcap_fixup.ctrlN", char, sizeof_string("\x0e")), _("\x0e"), true);
    let ctrlO = init_string(static_array("tty_decgraphics_termcap_fixup.ctrlO", char, sizeof_string("\x0f")), _("\x0f"), true);
    let appMode = init_string(static_array("tty_decgraphics_termcap_fixup.appMode", char, sizeof_string("\x1b=")), _("\x1b="), true);
    let numMode = init_string(static_array("tty_decgraphics_termcap_fixup.numMode", char, sizeof_string("\x1b>")), _("\x1b>"), true);

    /* these values are missing from some termcaps */
    if (!AS())
        gt.tc_gbl_data.tc_AS = ctrlN; /* ^N (shift-out [graphics font]) */
    if (!AE())
        gt.tc_gbl_data.tc_AE = ctrlO; /* ^O (shift-in  [regular font])  */
    if (!KS[0])
        KS[0] = appMode; /* ESC= (application keypad mode) */
    if (!KE[0])
        KE[0] = numMode; /* ESC> (numeric keypad mode) */
    /*
     * Select the line-drawing character set as the alternate font.
     * Do not select NA ASCII as the primary font since people may
     * reasonably be using the UK character set.
     */
    if (SYMHANDLING(H_DEC)) {
        xputs(_("\x1b)0")); /* "\e)0" load line drawing chars as secondary set */
        /* TI doesn't necessarily do this; explicitly switch to primary
           font in case previous program (either before starting nethack
           or during a shell escape) left the alternate font active */
        xputs(AE());
    }

    /* #if DECgraphicsOptimization: not in this build */

    /* if AE is still present in HE, set a flag so that glyph writing
       code will know that AS needs to be refreshed for consecutive
       line drawing characters */
    let ae = AE();

    if (digit(chars[ae])) { /* skip over delay prefix, if any */
        do
            ++ae;
        while (digit(chars[ae]));
        if (chars[ae] == ord('.')) {
            ++ae;
            if (digit(chars[ae]))
                ++ae;
        }
        if (chars[ae] == ord('*'))
            ++ae;
    }
    /* stdc strstr(), not nethack's strstri(); HE ends color, ME ends
       inverse video; they might have the same value; sequences to end
       other attributes aren't known to sometimes contain AE */
    if ((nh_HE() && strstr(nh_HE(), ae)) || (ME[0] && strstr(ME[0], ae)))
        HE_resets_AS = TRUE;

    /* #ifdef DECgraphicsOptimization: not in this build */

    xputs(AE());
}

 /* defined in symbols.c */

/* #ifdef PC9800: not in this build */

export function term_start_screen() { /* void */
    xputs(TI[0]);
    xputs(VS[0]);
    /* #ifdef PC9800: not in this build */

    if (SYMHANDLING(H_DEC))
        tty_decgraphics_termcap_fixup();
    /* set up callback in case option is not set yet but toggled later */
    decgraphics_mode_callback = tty_decgraphics_termcap_fixup;

    utf8graphics_mode_callback = tty_utf8graphics_fixup;

    if (gc.Cmd.num_pad)
        tty_number_pad(1); /* make keypad send digits */
}

export function term_end_screen() { /* void */
    term_clear_screen();
    xputs(VE[0]);
    xputs(TE[0]);
}

/* Cursor movements */

/* Note to overlay tinkerers.  The placement of this overlay controls the
   location of the function xputc().  This function is not currently in
   trampoli.[ch] files for what is deemed to be performance reasons.  If
   this define is moved and or xputc() is taken out of the ROOT overlay,
   then action must be taken in trampoli.[ch]. */

export function nocmov(x, y) { /* void */
    if (ttyDisplay.cury > y) {
        if (UP[0]) {
            while (ttyDisplay.cury > y) { /* Go up. */
                xputs(UP[0]);
                ttyDisplay.cury--;
            }
        } else if (nh_CM()) {
            cmov(x, y);
        } else if (HO[0]) {
            home();
            tty_curs(BASE_WINDOW, x + 1, y);
        } /* else impossible("..."); */
    } else if (ttyDisplay.cury < y) {
        if (XD[0]) {
            while (ttyDisplay.cury < y) {
                xputs(XD[0]);
                ttyDisplay.cury++;
            }
        } else if (nh_CM()) {
            cmov(x, y);
        } else {
            while (ttyDisplay.cury < y) {
                xputc(ord('\n'));
                ttyDisplay.curx = 0;
                ttyDisplay.cury++;
            }
        }
    }
    if (ttyDisplay.curx < x) { /* Go to the right. */
        if (!nh_ND()) {
            cmov(x, y);
        } else { /* bah */
             /* should instead print what is there already */
            while (ttyDisplay.curx < x) {
                xputs(nh_ND());
                ttyDisplay.curx++;
            }
        }
    } else if (ttyDisplay.curx > x) {
        while (ttyDisplay.curx > x) { /* Go to the left. */
            xputs(BC[0]);
            ttyDisplay.curx--;
        }
    }
}

export function cmov(x, y) { /* void */
    xputs(tgoto(nh_CM(), x, y));
    ttyDisplay.cury = y;
    ttyDisplay.curx = x;
}

/* See note above.  xputc() is a special function for overlays. */
export function xputc(c) { /* int */ /* actually char, but explicitly specify its widened type */
    /*
     * Note:  xputc() as a direct all to putchar() doesn't make any
     * sense _if_ putchar() is a function.  But if it is a macro, an
     * overlay configuration would want to avoid hidden code bloat
     * from multiple putchar() expansions.  And it gets passed as an
     * argument to tputs() so we have to guarantee an actual function
     * (while possibly lacking ANSI's (func) syntax to override macro).
     *
     * xputc() used to be declared as 'void xputc(c) char c; {}' but
     * avoiding the proper type 'int' just to avoid (void) casts when
     * ignoring the result can't have been sufficient reason to add it.
     * It also had '#if apollo' conditional to have the arg be int.
     * Matching putchar()'s declaration and using explicit casts where
     * warranted is more robust, so we're just a jacket around that.
     */
    return putchar(c);
}

/* In-band sync markers for screen recording.
 *
 * When NOMUX_MARKERS=1 is set in the environment, NetHack emits OSC
 * sequences to stdout at every input-wait boundary (and once at game
 * end after topten output), each carrying the rendered screen state
 * for that boundary.  A recorder reading stdout parses these markers
 * and uses the embedded screen as the captured frame for the step.
 *
 * Marker wire format:
 *   ESC ] 7777 ; KIND=input ; SEQ=N ; CX=cx ; CY=cy ; LEN=L BEL
 *   <L bytes of screen content>
 *
 * The OSC body up through BEL contains only printable ASCII so the
 * recorder can parse it unambiguously.  The L payload bytes that
 * follow are the rendered screen serialization (escape-sequences
 * preserved verbatim, no encoding) and may contain arbitrary bytes
 * including ESC.  The recorder reads exactly L bytes after the BEL.
 *
 * KIND=input fires at tty_nhgetch / tty_nh_poskey blocking points and
 * once at nh_terminate (post-topten final frame).  KIND=anim fires
 * for intermediate animation frames (zap beams, knockback, thrown
 * objects); these don't bump SEQ since they aren't input boundaries.
 *
 * When NOMUX_MARKERS is unset the emit is a no-op — the binary plays
 * normally with no extra stdout output. */

function nomux_markers_enabled() { /* int */
    let cached = static_var("nomux_markers_enabled.cached", int, -1);
    if (cached[0] < 0) {
        let ev = getenv(_("NOMUX_MARKERS"));
        cached[0] = (ev && chars[ev] && chars[ev + 0] != ord('0')) ? 1 : 0;
    }
    return cached[0];
}

const nomux_seq = static_var("nomux_seq", int, 0);
global_scalar("nomux_anim_id", int, 0);

/* the capture buffer as it is laid out for long captures, see
   nomux_ref_overflow_state() */
export const NOMUX_REF_RAW_ACTIVE = 6144;
export const NOMUX_REF_RAW_ROW = 6148;
export const NOMUX_REF_RAW_COL = 6152;
export const NOMUX_REF_STDOUT_BUF = 6448;
export const NOMUX_REF_STDOUT_BUFSIZ = 1024;

/* Emit a single in-band marker carrying the current rendered screen.
 * KIND distinguishes input boundaries from animation frames. */
function nomux_emit_marker(kind) { /* void */
    const $frame = stack_frame(); try {
    let scr = nomux_capture_screen();
    let cx = stack_var(int), cy = stack_var(int);
    let scr_len = scr ? strlen(scr) : 0;
    if (scr_len >= NOMUX_REF_RAW_ACTIVE)
        nomux_ref_overflow_state(scr, scr_len);
    nomux_get_cursor(cx, cy);
    if (scr_len > NOMUX_REF_STDOUT_BUF)
        nomux_ref_overflow_payload(scr, scr_len, kind, cx[0], cy[0]);
    nhjs_tty_capture_boundary(kind, nomux_seq[0], nomux_anim_id, cx[0], cy[0], scr);
    if (getenv(_("NHJS_SUPPRESS_NOMUX_MARKERS")))
        return;
    if (!nomux_markers_enabled())
        return;

    {
        fprintf(stdout, _("\x1b]7777;KIND=%s;SEQ=%d;ANIM=%d;CX=%d;CY=%d;LEN=%zu\x07"),
                kind, nomux_seq[0], nomux_anim_id, cx[0], cy[0], scr_len);
        if (scr_len > 0)
            fwrite(scr, 1, scr_len, stdout);
        fflush(stdout);
    }
    } finally { stack_pop($frame); }
}

/* Called for intermediate animation frames: zap beams, hurtle/knockback
 * steps, thrown-object trajectories, etc.  Bumps the per-animation id
 * but NOT the input-boundary SEQ. */
export function nomux_capture_write_screen() { /* void */
    nomux_anim_id++;
    nomux_emit_marker(_("anim"));
}

/* Called at every real input-wait boundary (tty_nhgetch, tty_nh_poskey)
 * and once at nh_terminate after topten — the points where one
 * authoritative frame should be captured per step.  Bumps SEQ. */
export function nomux_capture_write_input_boundary() { /* void */
    nomux_seq[0]++;
    nomux_emit_marker(_("input"));
}

/* NOMUX shadow frame buffer implementation */
export const nomux_buf = static_array("nomux_buf", array_of(nomux_cell, 80), 24);
const nomux_fg_cur = static_var("nomux_fg_cur", uchar, 7);
const nomux_attr_cur = static_var("nomux_attr_cur", uchar, 0);
const nomux_decgfx_cur = static_var("nomux_decgfx_cur", uchar, 0);

export function nomux_clear_screen() { /* void */
    let r, c;
    for (r = 0; r < 24; r++)
        for (c = 0; c < 80; c++) {
            nomux_buf[r][c].ch = ord(' ');
            nomux_buf[r][c].fg = 7;
            nomux_buf[r][c].attr = 0; nomux_buf[r][c].decgfx = 0;
        }
}

export function nomux_clear_to_eol(row, col) { /* void */
    let c;
    if (row < 0 || row >= 24) return;
    for (c = (col < 0 ? 0 : col); c < 80; c++) {
        nomux_buf[row][c].ch = ord(' ');
        nomux_buf[row][c].fg = 7;
        nomux_buf[row][c].attr = 0;
        /* Reset decgfx too: cl_end's job is to wipe a region, and a
         * cleared cell shouldn't carry a graphics-mode flag from
         * whatever character occupied that position before. Without
         * this, leftover decgfx from the prior screen's map glyphs
         * (walls, floors) leaks into menu indent columns and shows
         * up in the wire as ESC-N space ESC-O around an otherwise
         * blank cell — visually identical to a regular space, but
         * not byte-equal across rebuilds or when comparing against
         * a JS port that clears decgfx on every overwrite. */
        nomux_buf[row][c].decgfx = 0;
    }
}

export function nomux_putch(ch) { /* void */
    let row, col;
    if (!ttyDisplay || ch < 32) return;
    row = ttyDisplay.cury;
    col = ttyDisplay.curx;
    if (row >= 0 && row < 24 && col >= 0 && col < 80) {
        nomux_buf[row][col].ch = char(ch);
        nomux_buf[row][col].fg = nomux_fg_cur[0];
        nomux_buf[row][col].attr = nomux_attr_cur[0];
        nomux_buf[row][col].decgfx = nomux_decgfx_cur[0];
    }
}

export function nomux_set_attr(attr) { /* void */
    switch (attr) {
    case ATR_INVERSE: nomux_attr_cur[0] |= 1; break;
    case ATR_BOLD:    nomux_attr_cur[0] |= 2; break;
    case ATR_ULINE:   nomux_attr_cur[0] |= 4; break;
    }
}
export function nomux_end_attr() { /* void */ nomux_attr_cur[0] = 0; }
export function nomux_set_fg(color) { /* void */
    /* Mirror C's wc2_darkgray remap: when that option is on,
     * hilites[CLR_BLACK] is wired to BRIGHT_BLACK so the terminal
     * receives [90m instead of [30m (plain black is invisible
     * against a black background).  The shadow buffer must track
     * the *visible* color, not the nominal index, or the capture
     * will diverge from what the terminal (and JS) sees. */
    if (color == CLR_BLACK && iflags.wc2_darkgray)
        color = 8;  /* index 8 -> ANSI 90m (bright black / dark gray) */
    nomux_fg_cur[0] = (color < 0 || color >= 16) ? 7 : uchar(color);
}
export function nomux_end_fg() { /* void */ nomux_fg_cur[0] = 7; }

function nomux_sgr_fg(fg) { /* int */
    if (fg >= 0 && fg <= 7) return 30 + fg;
    if (fg >= 8 && fg <= 15) return 90 + (fg - 8);
    return 37;
}

const nomux_out = static_array("nomux_out", char, 24 * 80 * 32);
export function nomux_capture_screen() { /* char * */
    let p = nomux_out;
    let row, col, end, cur_fg, cur_attr;
    /* tmux capture-pane -e format:
     * - Color start: \033[97m (just the code, no 0; prefix)
     * - Color end (to default): \033[39m (fg reset only)
     * - Attr start: \033[7m (inverse), \033[1m (bold)
     * - Attr end: \033[27m (end inverse), \033[22m (end bold)
     * - Full reset: \033[0m only at end-of-line or when both attr+color reset
     * Incremental: only emit what changes between cells. */
    for (row = 0; row < 24; row++) {
        cur_fg = 7; cur_attr = 0;
        end = 79;
        while (end >= 0
               && (nomux_buf[row][end].ch == ord(' ') || nomux_buf[row][end].ch == 0)
               && nomux_buf[row][end].attr == 0
               && (nomux_buf[row][end].fg == 7 || nomux_buf[row][end].fg == 0))
            end--;
        let in_dec = 0;
        for (col = 0; col <= end; col++) {
            let c = nomux_buf[row][col];
            let ch = c.ch ? c.ch : ord(' ');
            let fg = c.fg ? c.fg : 7;
            let at = c.attr;
            /* Emit incremental SGR changes */
            if (at != cur_attr) {
                /* Handle attr changes individually */
                if ((at & 1) && !(cur_attr & 1)) p += sprintf(p, _("\x1b[7m"));
                if (!(at & 1) && (cur_attr & 1)) p += sprintf(p, _("\x1b[27m"));
                if ((at & 2) && !(cur_attr & 2)) p += sprintf(p, _("\x1b[1m"));
                if (!(at & 2) && (cur_attr & 2)) p += sprintf(p, _("\x1b[22m"));
                if ((at & 4) && !(cur_attr & 4)) p += sprintf(p, _("\x1b[4m"));
                if (!(at & 4) && (cur_attr & 4)) p += sprintf(p, _("\x1b[24m"));
                cur_attr = at;
            }
            if (fg != cur_fg) {
                if (fg == 7) {
                    p += sprintf(p, _("\x1b[39m")); /* reset fg to default */
                } else {
                    p += sprintf(p, _("\x1b[%dm"), nomux_sgr_fg(fg));
                }
                cur_fg = fg;
            }
            if (c.decgfx && !in_dec) { chars[p++] = ord('\x0e'); in_dec = 1; }
            else if (!c.decgfx && in_dec) { chars[p++] = ord('\x0f'); in_dec = 0; }
            chars[p++] = ch;
        }
        if (in_dec) { chars[p++] = ord('\x0f'); in_dec = 0; }
        /* End-of-line: reset to defaults — match tmux format */
        if (cur_attr && cur_fg != 7) {
            p += sprintf(p, _("\x1b[0m"));  /* both attr+color: full reset */
        } else if (cur_attr) {
            p += sprintf(p, _("\x1b[0m"));  /* attr only: full reset */
        } else if (cur_fg != 7) {
            p += sprintf(p, _("\x1b[39m")); /* color only: fg reset */
            cur_fg = 7; cur_attr = 0;
        }
        if (row < 23) chars[p++] = ord('\n');
    }
    chars[p] = ord('\0');
    return nomux_out;
}

/* Raw-mode shadow tracking for tty_raw_print / tty_raw_print_bold output.
 * The C code calls these directly via puts() and fputs(), bypassing the
 * normal wintty rendering pipeline (no tty_putsym/tty_putstr indirection).
 * The default end-of-game high-score panel (topten() with iflags.toptenwin
 * == FALSE) goes through this path entirely, so without these hooks the
 * NOMUX shadow buffer is blind to it.
 *
 * Raw mode is entered on the first raw_print after ttyDisplay is gone
 * (typical post-exit_nhwindows endgame sequence) or by an explicit call
 * to nomux_enter_raw_mode(). It uses its own row/col counters because
 * ttyDisplay is null at this point.
 */
const nomux_raw_active = static_var("nomux_raw_active", int, 0);
const nomux_raw_row = static_var("nomux_raw_row", int, 0);
const nomux_raw_col = static_var("nomux_raw_col", int, 0);

export function nomux_enter_raw_mode() { /* void */
    nomux_raw_active[0] = 1;
    nomux_raw_row[0] = 0;
    nomux_raw_col[0] = 0;
    /* exit_nhwindows / settty switch off alt-screen, so the visible
     * terminal returns to a blank main-screen state before the high-score
     * lines print. Mirror that by clearing the shadow. */
    nomux_clear_screen();
}

function nomux_raw_putch(ch) { /* void */
    if (ch == ord('\n')) {
        nomux_raw_row[0]++;
        nomux_raw_col[0] = 0;
        return;
    }
    if (ch < 32) return;
    if (nomux_raw_row[0] >= 0 && nomux_raw_row[0] < 24
        && nomux_raw_col[0] >= 0 && nomux_raw_col[0] < 80) {
        nomux_buf[nomux_raw_row[0]][nomux_raw_col[0]].ch = char(ch);
        nomux_buf[nomux_raw_row[0]][nomux_raw_col[0]].fg = nomux_fg_cur[0];
        nomux_buf[nomux_raw_row[0]][nomux_raw_col[0]].attr = nomux_attr_cur[0];
        nomux_buf[nomux_raw_row[0]][nomux_raw_col[0]].decgfx = nomux_decgfx_cur[0];
    }
    nomux_raw_col[0]++;
}

/* Write a string emitted by tty_raw_print / tty_raw_print_bold to the
 * shadow buffer, then bump SEQ so the harness re-reads the file.
 * If raw mode is not yet active and ttyDisplay is gone, enter raw mode
 * automatically (typical endgame path).
 *
 * Under NOMUX_MARKERS we have no tmux fallback, so we ALSO enter raw
 * mode when ttyDisplay is still alive — otherwise tty_suspend_nhwindows
 * goodbye strings ("Be seeing you...", "Saving...") arrive before
 * ttyDisplay is freed and would never reach the shadow buffer.
 *
 * BUT we skip *empty* raw_prints while ttyDisplay is alive: those are
 * flush/separator calls (pline-flushers, tty_raw_print_bold("") visual
 * spacing) that the tmux capture path also discarded. Treating them as
 * content would shift end-of-game output (topten) down by a row. */
export function nomux_raw_emit(s, bold) { /* void */
    if (!nomux_raw_active[0]) {
        if (ttyDisplay && (!chars[s] || !nomux_markers_enabled()))
            return;  /* in-game flush, or no-marker mode → skip */
        nomux_enter_raw_mode();
    }
    if (bold) nomux_attr_cur[0] |= 2;
    for (let p = s; chars[p]; p++)
        nomux_raw_putch(uchar((chars[p])));
    nomux_raw_putch(ord('\n'));  /* puts() / tty_raw_print_bold both append a newline */
    if (bold) nomux_attr_cur[0] = 0;
    /* INTENTIONALLY do NOT call nomux_capture_write_input_boundary() here.
     *
     * The Python harness side (run_session.py:wait_for_nomux_advance)
     * waits for SEQ to advance past prev_seq, then reads the screen file.
     * If raw_emit bumps SEQ on EVERY call, the harness sees SEQ advance
     * after the FIRST emit and proceeds to read the screen — capturing
     * INTERMEDIATE topten output (e.g. blank-only-emitted, before
     * "You made the top ten list!" is written). This produced a
     * non-deterministic 1-blank vs 2-blank pattern in seed0030 segs
     * 1/2/5/7 (issue #460). Adding a tiny I/O delay here (an fopen+fclose
     * for debug) was enough to consistently shift to 1-blank for all
     * segments — confirming the race.
     *
     * Letting the next tty_nhgetch / tty_nh_poskey call's
     * nomux_capture_write_input_boundary fire is not enough at game-end
     * because there's no further input wait after topten — the next
     * thing is nh_terminate(). So we add a single write at nh_terminate
     * (see src/end.c) to capture the final state once topten has
     * finished emitting. */
}

export function nomux_raw_emit_eol() { /* void */
    if (nomux_raw_active[0]) nomux_raw_putch(ord('\n'));
}

export function nomux_get_cursor(cx, cy) { /* void */
    if (nomux_raw_active[0]) {
        cx[0] = nomux_raw_col[0];
        cy[0] = nomux_raw_row[0];
        return;
    }
    cx[0] = ttyDisplay ? ttyDisplay.curx : 0;
    cy[0] = ttyDisplay ? ttyDisplay.cury : 0;
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
function nomux_ref_overflow_enabled() { /* int */
    let cached = static_var("nomux_ref_overflow_enabled.cached", int, -1);

    if (cached[0] < 0) {
        let ev = getenv(_("NHJS_UNBOUNDED_CAPTURE"));

        cached[0] = (ev && chars[ev] && chars[ev + 0] != ord('0')) ? 0 : 1;
    }
    return cached[0];
}

function nomux_ref_overlay(value, offset, scr, len) { /* int */
    let u = unsigned(value);
    let i;

    for (i = 0; i < 4; i++) {
        let at = unsigned(offset + unsigned(i));
        let mask = unsigned(0xff << (8 * i));

        if (at < len)
            u = unsigned(unsigned(u & unsigned(~mask))
                | unsigned(uchar((chars[scr + at])) << (8 * i)));
        else if (at == len)
            u = unsigned(u & unsigned(~mask));
    }
    return int(u);
}

function nomux_ref_overflow_state(scr, len) { /* void */
    if (!nomux_ref_overflow_enabled())
        return;
    nomux_raw_active[0] = nomux_ref_overlay(nomux_raw_active[0],
                                         NOMUX_REF_RAW_ACTIVE, scr, len);
    nomux_raw_row[0] = nomux_ref_overlay(nomux_raw_row[0], NOMUX_REF_RAW_ROW,
                                      scr, len);
    nomux_raw_col[0] = nomux_ref_overlay(nomux_raw_col[0], NOMUX_REF_RAW_COL,
                                      scr, len);
}

function nomux_ref_overflow_payload(scr, len, kind, cx,
                           cy) { /* void */
    const $frame = stack_frame(); try {
    let hdr = stack_array(char, BUFSZ);
    let n, i, end;

    if (!nomux_ref_overflow_enabled())
        return;
    n = unsigned(snprintf(hdr, sizeof(array_of(char, BUFSZ)),
                 _("\x1b]7777;KIND=%s;SEQ=%d;ANIM=%d;CX=%d;CY=%d;LEN=%zu\x07"),
                 kind, nomux_seq[0], nomux_anim_id, cx, cy, len));
    end = NOMUX_REF_STDOUT_BUF + NOMUX_REF_STDOUT_BUFSIZ;
    if (end > len)
        end = len;
    for (i = NOMUX_REF_STDOUT_BUF; i < end; i++) {
        let k = unsigned(i - NOMUX_REF_STDOUT_BUF);

        chars[scr + i] = (k < n) ? chars[hdr + k] : chars[scr + unsigned(k - n)];
    }
    } finally { stack_pop($frame); }
}

export function xputs(s) { /* void */
    tputs(s, 1, xputc);
}

export function cl_end() { /* void */
    if (CE[0]) {
        xputs(CE[0]);

        nomux_clear_to_eol(ttyDisplay.cury, ttyDisplay.curx);
    } else { /* no-CE fix - free after Harold Rynes */
        let cx = ttyDisplay.curx + 1;

        /* this looks terrible, especially on a slow terminal
           but is better than nothing */
        while (cx < CO()) {
            xputc(ord(' '));
            cx++;
        }
        tty_curs(BASE_WINDOW, ttyDisplay.curx + 1,
                 ttyDisplay.cury);
    }
}

export function term_clear_screen() { /* void */
    /* note: if CL is null, then termcap initialization failed,
     * so don't attempt screen-oriented I/O during final cleanup.
     */
    if (CL[0]) {
        xputs(CL[0]);
        home();
        /* set remembered data to all spaces */

        nomux_clear_screen();

        erase_tty_screen();
    }
}

export function home() { /* void */
    if (HO[0])
        xputs(HO[0]);
    else if (nh_CM())
        xputs(tgoto(nh_CM(), 0, 0));
    else
        tty_curs(BASE_WINDOW, 1, 0); /* using UP ... */
    ttyDisplay.curx = ttyDisplay.cury = 0;
}

export function standoutbeg() { /* void */
    if (SO[0])
        xputs(SO[0]);
}

export function standoutend() { /* void */
    if (SE[0])
        xputs(SE[0]);
}

/* #if 0: not in this build */

export function backsp() { /* void */
    xputs(BC[0]);
}

export function tty_nhbell() { /* void */
    if (flags.silent)
        return;
    putchar(ord('\x07')); /* curx does not change */
    fflush(stdout);
}

export function graph_on() { /* void */
    nomux_decgfx_cur[0] = 1;

    if (AS())
        xputs(AS());
}

export function graph_off() { /* void */
    nomux_decgfx_cur[0] = 0;

    if (AE())
        xputs(AE());
}

const tmspc10 = static_array("tmspc10", short, null, [ /* from termcap */
                                 0, 2000, 1333, 909, 743, 666, 500, 333, 166,
                                 83, 55, 41, 20, 10, 5
]);

/* delay 50 ms */
export function tty_delay_output() { /* void */
    let no_delay = static_var("tty_delay_output.no_delay", int, -1);
    let no_delay_env;

    if (no_delay[0] < 0) {
        no_delay_env = getenv(_("NETHACK_NO_DELAY"));
        if (!no_delay_env || !chars[no_delay_env])
            no_delay_env = getenv(_("WEBHACK_NO_DELAY"));
        no_delay[0] = (no_delay_env && chars[no_delay_env] && chars[no_delay_env] != ord('0') ? 1 : 0);
    }
    if (no_delay[0] || iflags.debug_fuzzer) {
        fflush(stdout);

        /* Capture the current screen at this animation boundary.
           This lets the session recorder see intermediate display
           states (zap beams, thrown objects, explosions) that would
           otherwise be invisible because the delay is suppressed.
           nomux_capture_write_screen appends to the anim log and
           bumps nomux_anim_id, which we include in the event marker
           so the appendix entry can be cross-referenced. */
        nomux_capture_write_screen();

        return;
    }

    /* BUG: if the padding character is visible, as it is on the 5620
       then this looks terrible. */
    if (flags.null) {
        tputs(

              _("50"),

              1, xputc);
    } else if (ospeed > 0 && ospeed < SIZE(tmspc10) && nh_CM()) {
        /* delay by sending cm(here) an appropriate number of times */
        let cmlen = int(strlen(tgoto(nh_CM(), ttyDisplay.curx, ttyDisplay.cury)));

        let i = 500 + Math.trunc(tmspc10[ospeed] / 2);

        while (i > 0) {
            cmov(ttyDisplay.curx, ttyDisplay.cury);
            i -= cmlen * tmspc10[ospeed];
        }
    }
}

/* must only be called with curx = 1 */
export function cl_eos() { /* void */ /* free after Robert Viduya */
    if (nh_CD()) {
        xputs(nh_CD());

        { let r; nomux_clear_to_eol(ttyDisplay.cury, ttyDisplay.curx); for (r = ttyDisplay.cury + 1; r < 24; r++) nomux_clear_to_eol(r, 0); }
    } else {
        let cy = ttyDisplay.cury + 1;

        while (cy <= LI() - 2) {
            cl_end();
            xputc(ord('\n'));
            cy++;
        }
        cl_end();
        tty_curs(BASE_WINDOW, ttyDisplay.curx + 1,
                 ttyDisplay.cury);
    }
}

/* #if defined(UNIX) && defined(TERMINFO): not in this build */

/* find the foreground and background colors set by nh_HI or nh_HE */
function analyze_seq(str, fg, bg) { /* void */
    let c, code;
    let len;

    fg[0] = bg[0] = NO_COLOR;

    c = (chars[str + 0] == ord('\x9b')) ? 1 : 2; /* index of char beyond esc prefix */
    len = int(unsigned(strlen(str) - 1));          /* length excluding attrib suffix */
    if ((c != 1 && (chars[str + 0] != ord('\x1b') || chars[str + 1] != ord('['))) || (len - c) < 1
        || chars[str + len] != ord('m'))
        return;

    while (c < len) {
        if ((code = atoi(str + c)) == 0) { /* reset */
            /* this also catches errors */

            fg[0] = bg[0] = NO_COLOR;
        } else if (code == 1) { /* bold */
            fg[0] |= BRIGHT;
        } else if (code == 7 || code == 27) { /* reverse */
            code = fg[0] & ~BRIGHT;
            fg[0] = bg[0] | (fg[0] & BRIGHT);
            bg[0] = code;
        } else if (code >= 30 && code <= 37) { /* hi_foreground RGB */
            fg[0] = code - 30;
        } else if (code >= 40 && code <= 47) { /* hi_background RGB */
            bg[0] = code - 40;
        }
        while (digit(chars[str + (++c)]))
            ;
        c++;
    }
}

/*
 * Sets up highlighting sequences, using ANSI escape sequences (highlight code
 * found in wintty.c).  The nh_HI and nh_HE sequences (usually from SO) are
 * scanned to find foreground and background colors.
 */

function init_hilite() { /* void */
    const $frame = stack_frame(); try {
    let c;
    iflags.colorcount = 256; /* the terminal's colour count */
    /* #ifdef TOS: not in this build */

    let backg = stack_var(int), foreg = stack_var(int), hi_backg = stack_var(int), hi_foreg = stack_var(int);

    for (c = 0; c < SIZE(hilites); c++)
        hilites[c] = nh_HI();
    hilites[CLR_GRAY] = hilites[NO_COLOR] = 0;

    analyze_seq(nh_HI(), hi_foreg, hi_backg);
    analyze_seq(nh_HE(), foreg, backg);

    for (c = 0; c < SIZE(hilites); c++)
        /* avoid invisibility */
        if ((backg[0] & ~BRIGHT) != c) {
            if (c == foreg[0]) {
                hilites[c] = 0;
            } else if (c != hi_foreg[0] || backg[0] != hi_backg[0]) {
                hilites[c] = addr_of(alloc(sizeof_string("\x1b[%d;3%d;4%dm")));
                sprintf(hilites[c], _("\x1b[%d"), +!!(c & BRIGHT));
                if ((c | BRIGHT) != (foreg[0] | BRIGHT))
                    sprintf(eos(hilites[c]), _(";3%d"), c & ~BRIGHT);
                if (backg[0] != CLR_BLACK)
                    sprintf(eos(hilites[c]), _(";4%d"), backg[0] & ~BRIGHT);
                strcat(hilites[c], _("m"));
            }
        }
    } finally { stack_pop($frame); }
}

function kill_hilite() { /* void */
    let c;

    for (c = 0; c < Math.trunc(CLR_MAX / 2); c++) {
        if (hilites[c | BRIGHT] == hilites[c])
            hilites[c | BRIGHT] = 0;
        if (hilites[c] && hilites[c] != nh_HI())
            free((hilites[c])), hilites[c] = 0;
        if (hilites[c | BRIGHT] && hilites[c | BRIGHT] != nh_HI())
            free((hilites[c | BRIGHT])), hilites[c | BRIGHT] = 0;
    }

    return;
}

/* #if !defined(TERMLIB) && defined(ANSI_DEFAULT): not in this build */

const nulstr = init_string(static_array("nulstr", char, sizeof_string("")), _(""), true);

function s_atr2str(n) { /* char * */
    switch (n) {
    case ATR_ITALIC:
        /* if italic isn't available, fall through to underline */
        if (ZH[0] && chars[ZH[0]])
            return ZH[0];
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ATR_BLINK:
    case ATR_ULINE:
        if (n == ATR_BLINK) {
            if (MB[0] && chars[MB[0]])
                return MB[0];
        } else { /* Underline */
            if (nh_US() && chars[nh_US()])
                return nh_US();
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ATR_BOLD:
        if (MD[0] && chars[MD[0]])
            return MD[0];
        if (nh_HI() && chars[nh_HI()])
            return nh_HI();
        break;
    case ATR_INVERSE:
        if (MR[0] && chars[MR[0]])
            return MR[0];
        break;
    case ATR_DIM:
        if (MH[0] && chars[MH[0]])
            return MH[0];
        break;
    }
    return nulstr;
}

function e_atr2str(n) { /* char * */
    switch (n) {
    case ATR_ITALIC:
        /* send ZR unless we didn't have ZH and substituted US */
        if (ZR[0] && chars[ZR[0]] && ZH[0] && chars[ZH[0]])
            return ZR[0];
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ATR_ULINE:
        if (nh_UE() && chars[nh_UE()])
            return nh_UE();
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ATR_BOLD:
    case ATR_BLINK:
        if (nh_HE() && chars[nh_HE()])
            return nh_HE();
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ATR_DIM:
    case ATR_INVERSE:
        if (ME[0] && chars[ME[0]])
            return ME[0];
        break;
    }
    return nulstr;
}

/* suppress nonfunctional highlights so render_status() might be able to
   optimize more; keep this in sync with s_atr2str() */
export function term_attr_fixup(msk) { /* int */
    /* underline is converted to bold if its start sequence isn't available */
    if ((msk & HL_ULINE) && (!nh_US() || !chars[nh_US()])) {
        msk |= HL_BOLD;
        msk &= ~HL_ULINE;
    }
    /* blink used to be converted to bold unconditionally; now depends on MB */
    /* blink is kept as blink, which the capture does not show */
    /* dim is ignored if its start sequence isn't available */
    if ((msk & HL_DIM) && (!MH[0] || !chars[MH[0]])) {
        msk &= ~HL_DIM;
    }
    return msk;
}

export function term_start_attr(attr) { /* void */
    if (attr) {
        let astr = s_atr2str(attr);

        if (astr && chars[astr]) {
            nomux_set_attr(attr);

            xputs(astr);
        }
    }
}

export function term_end_attr(attr) { /* void */
    if (attr) {
        let astr = e_atr2str(attr);

        if (astr && chars[astr]) {
            nomux_end_attr();

            xputs(astr);
        }
    }
}

/* this is called 'start bold' but HI is derived from SO (standout) rather
   than from MD (start bold attribute) */
export function term_start_raw_bold() { /* void */
    let soOn = nh_HI() ? nh_HI() : tty_standout_on;

    if (chars[soOn])
        xputs(soOn);
}

/* this is called 'end bold' but HE is derived from ME (end all attributes) */
export function term_end_raw_bold() { /* void */
    let soOff = nh_HE() ? nh_HE() : tty_standout_off;

    if (chars[soOff])
        xputs(soOff);
}

export function term_end_color() { /* void */
    if (nh_HE() && chars[nh_HE()]) {
        xputs(nh_HE());

        nomux_end_fg();
        nomux_end_attr();
    }
}

export function term_start_color(color) { /* void */
    if (color == NO_COLOR) {
        if (nh_HE() && chars[nh_HE()]) {
            xputs(nh_HE()); /* inline term_end_color() */

            nomux_end_fg();
            nomux_end_attr();
        }
    } else if (color < CLR_MAX && hilites[color] && chars[hilites[color]]) {
        nomux_set_fg(color);

        xputs(hilites[color]);
    }
}

export function term_start_bgcolor(color) { /* void */
    const $frame = stack_frame(); try {
    let tmp = stack_array(char, 8);
    sprintf(tmp, _("\x1b[%dm"), ((color % 8) + 40));
    xputs(tmp);
    } finally { stack_pop($frame); }
}

/* hide or show cursor */
export function term_curs_set(visibility) { /* void */
    let vis = static_var("term_curs_set.vis", int, -1);

    if (vis[0] == visibility)
        return;

    if (!visibility && nh_VI[0])
        xputs(nh_VI[0]);
    else if (visibility && nh_VE[0])
        xputs(nh_VE[0]);
    vis[0] = visibility;
}

/* #ifdef CHANGE_COLOR: not in this build */

export const tcfmtstr = "\x1b[38;2;%lld;%lld;%lldm";

export const tcfmtstr256 = "\x1b[38;5;%dm";

function emit24bit(mcolor) { /* void */
    let tcolorbuf = static_array("emit24bit.tcolorbuf", char, QBUFSZ);

    Snprintf(tcolorbuf, sizeof(array_of(char, QBUFSZ)), _(tcfmtstr), (shr64(mcolor, 16) & 0xFF), (shr64(mcolor, 8) & 0xFF), (shr64(mcolor, 0) & 0xFF))

;  /* blue */
    xputs(tcolorbuf);
}

function emit256(color256idx) { /* void */
    let tcolorbuf = static_array("emit256.tcolorbuf", char, QBUFSZ);

    Snprintf(tcolorbuf, sizeof(array_of(char, QBUFSZ)), _(tcfmtstr256), color256idx)
;
    xputs(tcolorbuf);
}

export function term_start_extracolor(customcolor, color256idx) { /* void */
    /* color 0 has bit 0x1000000 set */
    let mcolor = (customcolor & 0xFFFFFF);
    if (iflags.colorcount == 256)
        emit256(color256idx);
    else
        emit24bit(mcolor);
}

export function term_end_extracolor() { /* void */
        xputs(_("\x1b[0m"));
}

/*termcap.c*/

import { HL_BOLD, HL_DIM, HL_ULINE } from "../../src/botl.h.js";
import { BRIGHT, CLR_BLACK, CLR_GRAY, CLR_MAX, NO_COLOR } from "../../src/color.h.js";
import { AE, AS, CO, LI } from "../../src/decl.h.macros.js";
import { BUFSZ, COLNO, FALSE, QBUFSZ, ROWNO, TRUE } from "../../src/global.h.js";
import { Snprintf } from "../../src/hacklib.h.macros.js";
import { nhStr } from "../../src/lint.h.macros.js";
import { H_DEC } from "../../src/sym.h.js";
import { SYMHANDLING } from "../../src/sym.h.macros.js";
import { struct_tc_lcl_data } from "../../src/tcap.h.js";
import { nh_CD, nh_CM, nh_HE, nh_HI, nh_ND, nh_UE, nh_US } from "../../src/tcap.h.macros.js";
import { nomux_cell } from "../../src/wintty.h.js";
import {
    ATR_BLINK, ATR_BOLD, ATR_DIM, ATR_INVERSE, ATR_ITALIC, ATR_ULINE,
} from "../../src/wintype.h.js";
import { SIZE } from "../../rt/cmacros.js";
import {
    char, int, ord, schar, short, sizeof, sizeof_string, uchar, unsigned,
} from "../../rt/ctypes.js";
import { global_scalar } from "../../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../../rt/heap.js";
import { shr64 } from "../../rt/int64.js";
import {
    atoi, fflush, fprintf, free, fwrite, getenv, putchar, snprintf, sprintf, stdout, strcat, strcpy,
    strlen, strncmp, strncpy, strstr,
} from "../../rt/libc.js";
import {
    init_string, stack_array, stack_var, static_array, static_struct, static_var,
} from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { addr_of, array_of, ptr_to } from "../../rt/struct.js";
import { alloc, dupstr } from "../../src/alloc.js";
import { flags, gc, gt, iflags } from "../../src/decl.js";
import { digit, eos } from "../../src/hacklib.js";
import { error } from "../../sys/c2js/nhjs_host.js";
import { nhjs_tty_capture_boundary, tty_utf8graphics_fixup } from "../../sys/c2js/nhjs_tty_api.js";
import { tgetent, tgetflag, tgetnum, tgetstr, tgoto, tputs } from "../../sys/share/tclib.js";
import { erase_tty_screen, setclipped, tty_curs, tty_raw_print, tty_wait_synch } from "./wintty.js";
