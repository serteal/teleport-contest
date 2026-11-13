/* NetHack 5.0	wintty.c	$NHDT-Date: 1737691300 2025/01/23 20:01:40 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.420 $ */
/* Copyright (c) David Cohrs, 1991                                */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Neither a standard out nor character-based control codes should be
 * part of the "tty look" windowing implementation.
 * h+ 930227
 */

/* It's still not clear I've caught all the cases for H2344.  #undef this
 * to back out the changes. */

/* leave this undefined; it produces bad screen output with rxvt-unicode */
/*#define DECgraphicsOptimization*/

/* #ifdef DEF_PAGER: not in this build */

/*
 * NetHack's core switches to a dummy windowing interface when it
 * detects SIGHUP, but that's no help for any interface routine which
 * is already in progress at the time, and there have been reports of
 * runaway disconnected processes which use up all available CPU time.
 * HUPSKIP() and HUPSKIP_RETURN(x) are used to try to cut them off so
 * that they return to the core instead attempting more terminal I/O.
 */

    /* morc=ESC - in case we bypass xwaitforspace() which sets that */

/* Interface definition, for windows.c */
export const tty_procs = static_struct("tty_procs", struct_window_procs, { name: _("tty"), wp_id: wp_tty,
    wincap: (0

     | WC_COLOR | WC_HILITE_PET | WC_INVERSE | WC_EIGHT_BIT_IN),
    wincap2: (0

     | WC2_SELECTSAVED

     | WC2_HILITE_STATUS | WC2_HITPOINTBAR | WC2_FLUSH_STATUS
     | WC2_RESET_STATUS

     | WC2_DARKGRAY | WC2_SUPPRESS_HIST | WC2_URGENT_MESG | WC2_STATUSLINES
     | WC2_U_UTF8STR | WC2_PETATTR

     | WC2_EXTRACOLORS

     | WC2_EXTRASTATUS
    ),
    has_color: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    win_init_nhwindows: tty_init_nhwindows, win_player_selection: tty_player_selection, win_askname: tty_askname, win_get_nh_event: tty_get_nh_event,
    win_exit_nhwindows: tty_exit_nhwindows, win_suspend_nhwindows: tty_suspend_nhwindows, win_resume_nhwindows: tty_resume_nhwindows,
    win_create_nhwindow: tty_create_nhwindow, win_clear_nhwindow: tty_clear_nhwindow, win_display_nhwindow: tty_display_nhwindow,
    win_destroy_nhwindow: tty_destroy_nhwindow, win_curs: tty_curs, win_putstr: tty_putstr,
    win_putmixed: tty_putmixed,
    win_display_file: tty_display_file, win_start_menu: tty_start_menu, win_add_menu: tty_add_menu, win_end_menu: tty_end_menu,
    win_select_menu: tty_select_menu, win_message_menu: tty_message_menu, win_mark_synch: tty_mark_synch,
    win_wait_synch: tty_wait_synch,
    win_cliparound: tty_cliparound,
    win_print_glyph: tty_print_glyph, win_raw_print: tty_raw_print, win_raw_print_bold: tty_raw_print_bold, win_nhgetch: tty_nhgetch,
    win_nh_poskey: tty_nh_poskey, win_nhbell: tty_nhbell, win_doprev_message: tty_doprev_message, win_yn_function: tty_yn_function,
    win_getlin: tty_getlin, win_get_ext_cmd: tty_get_ext_cmd, win_number_pad: tty_number_pad, win_delay_output: tty_delay_output,
    win_outrip: genl_outrip,
    win_preference_update: tty_preference_update,
    win_getmsghistory: tty_getmsghistory, win_putmsghistory: tty_putmsghistory,
    win_status_init: tty_status_init,
    win_status_finish: genl_status_finish, win_status_enablefield: tty_status_enablefield,
    win_status_update: tty_status_update,
    win_can_suspend: genl_can_suspend_yes,
    win_update_inventory: tty_update_inventory,
    win_ctrl_nhwindow: tty_ctrl_nhwindow });

global_scalar("BASE_WINDOW", int);
export const wins = static_array("wins", ptr_to(struct_WinDesc), MAXWIN);
global_scalar("ttyDisplay", ptr_to(struct_DisplayDesc)); /* the tty display descriptor */

   /* from termcap.c */
 /* from termcap.c */

const erasing_tty_screen = static_var("erasing_tty_screen", int); /* volatile: SIGWINCH */

const obuf = static_array("obuf", char, BUFSIZ); /* BUFSIZ is defined in stdio.h */

const winpanicstr = init_string(static_array("winpanicstr", char, sizeof_string("Bad window Id %d (%s)")), _("Bad window Id %d (%s)"), true);

export const defmorestr = init_string(static_array("defmorestr", char, sizeof_string("--More--")), _("--More--"), true);

const clipping = static_var("clipping", schar, FALSE); /* clipping on? */
const clipx = static_var("clipx", int, 0); const clipxmax = static_var("clipxmax", int, 0);
const clipy = static_var("clipy", int, 0); const clipymax = static_var("clipymax", int, 0);

global_scalar("GFlag", schar, FALSE);
global_scalar("HE_resets_AS", schar); /* see termcap.c */

 /* __attribute__((noreturn)) */

export const MAX_STATUS_ROWS = 3;
export function StatusRows() { return ((iflags.wc2_statuslines <= 2) ? 2 : MAX_STATUS_ROWS); }

const calling_from_update_inventory = static_var("calling_from_update_inventory", schar, FALSE);
/* #ifdef TTY_PERM_INVENT: not in this build */

/*
 * A string containing all the default commands -- to add to a list
 * of acceptable inputs.
 */
const default_menu_cmds = static_array("default_menu_cmds", char, null, [
    MENU_FIRST_PAGE,    MENU_LAST_PAGE,   MENU_NEXT_PAGE,
    MENU_PREVIOUS_PAGE, MENU_SELECT_ALL,  MENU_UNSELECT_ALL,
    MENU_INVERT_ALL,    MENU_SELECT_PAGE, MENU_UNSELECT_PAGE,
    MENU_INVERT_PAGE,   MENU_SEARCH,      0 /* null terminator */
]);

/* #ifdef TTY_TILES_ESCCODES: not in this build */

/* #if defined(USER_SOUNDS) && defined(TTY_SOUND_ESCCODES): not in this build */

/* clean up and quit */
function bail(mesg) { /* void */
    clearlocks();
    tty_exit_nhwindows(mesg);
    nh_terminate(EXIT_SUCCESS);
    /*NOTREACHED*/
}

const resize_mesg = static_var("resize_mesg", int, 0);

/* signal handler is called with at least 1 arg */
/*ARGUSED*/
function winch_handler(sig_unused) { /* void */
    program_state.resize_pending++; /* resize_tty() will reset it */
    /* if nethack is waiting for input, which is the most likely scenario,
       we will go ahead and respond to the resize immediately; otherwise,
       tty_nhgetch() will do so the next time it's called */
    if (program_state.getting_char) {
        resize_tty();
    }
    return;
}

/* query the system for tty size (vis getwindowsz()), and adapt the game's
   windows to match */
function resize_tty() { /* void */
    let oldLI = LI(), oldCO = CO(), mapx, mapy, oldtoplin, i;
    let map_active;
    let cw;

    /* reset to 0 rather than just decrement */
    program_state.resize_pending = 0;
    resize_mesg[0] = 0;

    getwindowsz(); /* update LI and CO */
    if (!ttyDisplay || (LI() == oldLI && CO() == oldCO))
        return;

    ttyDisplay.rows = LI();
    ttyDisplay.cols = CO();

    cw = wins[BASE_WINDOW];
    cw.rows = ttyDisplay.rows;
    cw.cols = ttyDisplay.cols;

    if (!iflags.window_inited)
        return;

    /* try to figure out where we'll want to leave the cursor */
    cw = (WIN_MAP != WIN_ERR) ? wins[WIN_MAP] : null;
    map_active = (cw && cw.active ? 1 : 0);
    if (!map_active)
        mapx = 1, mapy = 0;
    else if (gg.getposx < 1)
        mapx = u.ux, mapy = u.uy;
    else
        mapx = gg.getposx, mapy = gg.getposy;

    oldtoplin = ttyDisplay.toplin;
    ttyDisplay.toplin = TOPLINE_EMPTY; /* (before term_clear_screen()) */
    /* whatever used to be on the screen has become suspect;
       blank it all out, then redo the display */
    term_clear_screen();
    new_status_window();

    /* if the map window is shown, redisplay it (also status, perminv) */
    if (map_active) {
        docrt_flags(docrtRefresh);
        bot(); /* context.botlx=1 gets set by docrt() */
        for (i = 0; i < MAXWIN; ++i) {
            if (i == BASE_WINDOW
                || i == WIN_MAP /* docrt() updates it */
                || i == WIN_STATUS /* docrt()+bot() updates it */

                || i == WIN_MESSAGE) /* we fake it here */
                continue;
            if (wins[i] && wins[i].active) {
                /* cop-out */
                oldtoplin = TOPLINE_EMPTY; /* don't restore it below */
                ttyDisplay.toplin = TOPLINE_NON_EMPTY;
                addtopl(_("Press a key to continue: "));
                resize_mesg[0]++;
                break;
            }
        }
    } /* wins[WIN_MAP].active */

    if (oldtoplin != TOPLINE_EMPTY) {
        ttyDisplay.toplin = oldtoplin;
        addtopl(gt.toplines);
    }
    if (map_active) {
        newclipping(mapx, mapy);
        tty_curs(WIN_MAP, mapx, mapy);
        tty_display_nhwindow(WIN_MAP, FALSE); /*fflush(stdout)*/
    }
    return;
}

function newclipping(x, y) { /* void */
    if (CO() < COLNO || LI() < 1 + ROWNO + iflags.wc2_statuslines) {
        setclipped(); /* sets clipping=TRUE */
        if (x)
            tty_cliparound(x, y);
    } else {
        clipping[0] = FALSE;
        clipx[0] = clipy[0] = 0;
    }

    return;
}

/* destroy and recreate status window; extracted from winch_handler()
   and augmented for use by tty_preference_update() */
function new_status_window() { /* void */
    if (WIN_STATUS != WIN_ERR) {
        /* in case it's shrinking, clear it before destroying so that
           dropped portion won't show anything that's now becoming stale */
        tty_clear_nhwindow(WIN_STATUS);
        tty_destroy_nhwindow(WIN_STATUS), WIN_STATUS = WIN_ERR;
    }
    /* frees some status tracking data */
    genl_status_finish();
    /* creates status window and allocates tracking data */
    tty_status_init();
    tty_clear_nhwindow(WIN_STATUS); /* does some init, sets context.botlx */

    status_initialize(TRUE);
}

/*ARGSUSED*/
export function tty_init_nhwindows(argcp, argv) { /* void */
    const $frame = stack_frame(); try {
    let wid = stack_var(int), hgt = stack_var(int), i;

    /* options aren't processed yet so wc2_statuslines might be 0;
       make sure that it has a reasonable value during tty setup */
    iflags.wc2_statuslines = StatusRows(); /* 2 or 3; 0 => 2 */
    /*
     *  Remember tty modes, to be restored on exit.
     *
     *  gettty() must be called before term_startup()
     *    due to ordering of LI/CO settings
     *  term_startup() must be called before initoptions()
     *    due to ordering of graphics settings
     */

    setbuf(stdout, obuf);

    gettty();

    /* to port dependant tty setup */
    term_startup(wid, hgt);
    setftty(); /* calls term_start_screen */
    term_curs_set(0);

    /* set up tty descriptor */
    ttyDisplay = view_of(struct_DisplayDesc, addr_of(alloc(sizeof(struct_DisplayDesc))));
    ttyDisplay.toplin = TOPLINE_EMPTY;
    ttyDisplay.topl_utf8 = 0;  /* putmixed may set this */
    ttyDisplay.rows = hgt[0];
    ttyDisplay.cols = wid[0];
    ttyDisplay.curx = ttyDisplay.cury = 0;
    ttyDisplay.inmore = ttyDisplay.inread = ttyDisplay.intr = 0;
    ttyDisplay.dismiss_more = 0;
    ttyDisplay.color = NO_COLOR;
    ttyDisplay.attrs = 0;
    ttyDisplay.topl_utf8 = 0;
    ttyDisplay.mixed = 0;

    /* set up the default windows */
    BASE_WINDOW = tty_create_nhwindow(NHW_BASE);
    wins[BASE_WINDOW].active = 1;

    ttyDisplay.lastwin = WIN_ERR;

    signal(SIGWINCH, winch_handler);

    tty_clear_nhwindow(BASE_WINDOW);

    /* Once pline() is functional, error-related prompts such as
     * those relating to save files etc. can intrude on the
     * copyright information display because their prompts are
     * up at the very top in the message window.
     * Move the copyright information a little further down to
     * row 3, out of the way. */

    tty_curs(BASE_WINDOW, 1, 4);
    for (i = 1; i <= 4; ++i)
        tty_putstr(BASE_WINDOW, 0, copyright_banner_line(i));
    tty_putstr(BASE_WINDOW, 0, _(""));
    tty_display_nhwindow(BASE_WINDOW, FALSE);

    /* Move to a default location for the "Shall I pick .." player
     * selection prompts, which also use the BASE_WINDOW. Leave
     * room for as many as 3 unexpected raw_prints early startup
     * messages above that.
     * If there is a topline message prompt, before the
     * "Shall I pick ..." prompt, the latter will end up appearing
     * immediately after the topline message prompt. There should
     * now be room. */
    tty_curs(BASE_WINDOW, 1, 11);

    /* 'statuslines' defaults to set_in_config, allowed but invisible;
       make it dynamically settable if feasible, otherwise visible */
    if ((tty_procs.wincap2 & WC2_STATUSLINES) != 0)
        set_wc2_option_mod_status(WC2_STATUSLINES,

                                      set_in_game);
    } finally { stack_pop($frame); }
}

export function tty_preference_update(pref) { /* void */
    let newstatuslines = (!strcmp(pref, _("statuslines"))
                              && iflags.window_inited ? 1 : 0);

    if (newstatuslines) {
        new_status_window();
        newclipping(u.ux, u.uy);
    }

    genl_preference_update(pref);

    /* #ifdef TTY_PERM_INVENT: not in this build */

    return;
}

export function tty_player_selection() { /* void */
    if (genl_player_setup(ttyDisplay.rows))
        return;

    bail(0);
    /*NOTREACHED*/
}

/*
 * svp.plname is filled either by an option (-u Player  or  -uPlayer) or
 * explicitly (by being the wizard) or by askname.
 * It may still contain a suffix denoting the role, etc.
 * Always called after init_nhwindows() and before
 * init_sound_disp_gamewindows().
 */
export function tty_askname() { /* void */
    let who_are_you = init_string(static_array("tty_askname.who_are_you", char, sizeof_string("Who are you? ")), _("Who are you? "), true);
    let c, ct, tryct = 0;

    if (iflags.wc2_selectsaved && !iflags.renameinprogress)
        switch (restore_menu(BASE_WINDOW)) {
        case -1:
            bail(_("Until next time then...")); /* quit */
            /*NOTREACHED*/
            break;
        case 0:
            break; /* no game chosen; start new game */
        case 1:
            return; /* svp.plname[] has been set */
        }

    tty_putstr(BASE_WINDOW, 0, _(""));
    do {
        if (++tryct > 1) {
            if (tryct > 10)
                bail(_("Giving up after 10 tries.\n"));
            tty_curs(BASE_WINDOW, 1, wins[BASE_WINDOW].cury - 1);
            tty_putstr(BASE_WINDOW, 0, _("Enter a name for your character..."));
            /* erase previous prompt (in case of ESC after partial response) */
            tty_curs(BASE_WINDOW, 1, wins[BASE_WINDOW].cury), cl_end();
        }
        tty_putstr(BASE_WINDOW, 0, who_are_you);
        tty_curs(BASE_WINDOW, sizeof_string("Who are you? "),
                 wins[BASE_WINDOW].cury - 1);
        ct = 0;
        while ((c = tty_nhgetch()) != ord('\n')) {
            if (c == EOF)
                c = ord('\x1b');
            if (c == ord('\r'))
                break;
            if (c == ord('\x1b')) {
                ct = 0;
                break;
            } /* continue outer loop */

            /* some people get confused when their erase char is not ^H */
            if (c == ord('\b') || c == ord('\x7f')) {
                if (ct) {
                    ct--;

                    putchar(ord('\b'));
                    putchar(ord(' '));
                    putchar(ord('\b'));

                    /* Mirror the visible erase into the NOMUX shadow
                     * buffer. The \b/space/\b sequence emitted above
                     * via putchar() bypasses nomux_putch (which
                     * ignores ch < 32). On UNIX, ttyDisplay->curx
                     * wasn't touched by the bare putchar() calls; on
                     * WIN32CON it was already decremented above.
                     * After this block, curx points at the erased
                     * column and the shadow buffer cell at that
                     * column holds a space — mirroring the real
                     * terminal. Without this, screen captures show
                     * the pre-erase char and subsequent typed chars
                     * land at the wrong column for the rest of the
                     * prompt. */

                    if (ttyDisplay.curx > 0)
                        ttyDisplay.curx--;

                    nomux_putch(ord(' '));
                }
                continue;
            }

            if (c != ord('-') && c != ord('@'))
                if (!(c >= ord('a') && c <= ord('z')) && !(c >= ord('A') && c <= ord('Z'))
                    /* reject leading digit but allow digits elsewhere
                       (avoids ambiguity when character name gets
                       appended to uid to construct save file name) */
                    && !(c >= ord('0') && c <= ord('9') && ct > 0))
                    c = ord('_');

            if (ct < sizeof_member(svp, "plname") - 1) {
                putchar(c);

                nomux_putch(c);
                ttyDisplay.curx++;

                chars[svp.plname + (ct++)] = c;
            }
        }
        chars[svp.plname + ct] = 0;
    } while (ct == 0);

    /* move to next line to simulate echo of user's <return> */
    tty_curs(BASE_WINDOW, 1, wins[BASE_WINDOW].cury + 1);

    /* since we let user pick an arbitrary name now, he/she can pick
       another one during role selection */
    iflags.renameallowed = TRUE;
}

export function tty_get_nh_event() { /* void */
    return;
}

function getret() { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    xputs(_("\n"));
    if (flags.standout)
        standoutbeg();
    xputs(_("Hit "));
    xputs(iflags.cbreak ? _("space") : _("return"));
    xputs(_(" to continue: "));
    if (flags.standout)
        standoutend();
    xwaitforspace(_(" "));

    iflags.raw_printed = 0;
}

export function tty_suspend_nhwindows(str) { /* void */
    term_curs_set(1);
    settty(str); /* calls end_screen, perhaps raw_print */
    if (!str)
        tty_raw_print(_("")); /* calls fflush(stdout) */
}

export function tty_resume_nhwindows() { /* void */
    gettty();
    setftty(); /* calls term_start_screen */
    term_curs_set(0);
    docrt();
}

export function tty_exit_nhwindows(str) { /* void */
    let i;

    tty_suspend_nhwindows(str);
    /*
     * Disable windows to avoid calls to window routines.
     */
    free_pickinv_cache(); /* reset its state as well as tear down window */
    for (i = 0; i < MAXWIN; i++) {
        if (i == BASE_WINDOW)
            continue; /* handle wins[BASE_WINDOW] last */
        if (wins[i]) {
            free_window_info(wins[i], TRUE);
            free(addr_of(wins[i]));

            wins[i] = null;
        }
    }
    WIN_MAP = WIN_MESSAGE = WIN_INVEN = WIN_ERR; /* these are all gone now */
    WIN_STATUS = WIN_ERR;

    if (BASE_WINDOW != WIN_ERR && wins[BASE_WINDOW]) {
        free_window_info(wins[BASE_WINDOW], TRUE);
        free(addr_of(wins[BASE_WINDOW]));
        wins[BASE_WINDOW] = null;
        BASE_WINDOW = WIN_ERR;
    }
    free(addr_of(ttyDisplay));
    ttyDisplay = null;

    term_shutdown(); /* cleanup termcap/terminfo/whatever */
    iflags.window_inited = 0;
}

export function tty_create_nhwindow(type) { /* winid */
    let newwin;
    let i, rowoffset;
    let newid;

    for (newid = 0; newid < MAXWIN; ++newid)
        if (wins[newid] == null)
            break;
    if (newid == MAXWIN) {
        panic(_("No window slots!"));
        /*NOTREACHED*/
        return WIN_ERR;
    }

    newwin = view_of(struct_WinDesc, addr_of(alloc(sizeof(struct_WinDesc))));
    wins[newid] = newwin;

    newwin.type = type;
    newwin.flags = 0;
    newwin.active = FALSE;
    newwin.curx = newwin.cury = 0;
    newwin.morestr = 0;
    newwin.mlist = null;
    newwin.plist = null;
    newwin.npages = newwin.plist_size = newwin.nitems = newwin.how = 0;
    newwin.mbehavior = 0;
    switch (type) {
    case NHW_BASE:
        /* base window, used for absolute movement on the screen */
        newwin.offx = newwin.offy = 0;
        newwin.rows = ttyDisplay.rows;
        newwin.cols = ttyDisplay.cols;
        newwin.maxrow = newwin.maxcol = 0;
        break;
    case NHW_MESSAGE:
        /* message window, 1 line long, very wide, top of screen */
        newwin.offx = newwin.offy = 0;
        /* sanity check */
        if (iflags.msg_history < 20)
            iflags.msg_history = 20;
        else if (iflags.msg_history > MAX_MSG_HISTORY)
            iflags.msg_history = MAX_MSG_HISTORY;
        newwin.maxrow = newwin.rows = iflags.msg_history;
        newwin.maxcol = newwin.cols = 0;
        break;
    case NHW_STATUS:
        /* status window, 2 or 3 lines long, full width, bottom of screen */
        if (iflags.wc2_statuslines < 2

            || iflags.wc2_statuslines > 3)
            iflags.wc2_statuslines = 2;
        newwin.offx = 0;
        rowoffset = ttyDisplay.rows - iflags.wc2_statuslines;

            newwin.offy = min(rowoffset, ROWNO + 1);
        newwin.rows = newwin.maxrow = iflags.wc2_statuslines;
        newwin.cols = newwin.maxcol = ttyDisplay.cols;
        break;
    case NHW_MAP:
        /* map window, ROWNO lines long, full width, below message window */
        newwin.offx = 0;
        newwin.offy = 1;
        newwin.rows = ROWNO;
        newwin.cols = COLNO;
        newwin.maxrow = 0; /* no buffering done -- let gbuf do it */
        newwin.maxcol = 0;
        break;
    case NHW_MENU:
    case NHW_TEXT:
        /* inventory/menu window, variable length, full width, top of screen;
           help window, the same, different semantics for display, etc */
        newwin.offx = newwin.offy = 0;
        newwin.rows = 0;
        newwin.cols = ttyDisplay.cols;
        newwin.maxrow = newwin.maxcol = 0;
        break;
    default:
        panic(_("Tried to create window type %d\n"), type);
        /*NOTREACHED*/
        return WIN_ERR;
    }

    if (newwin.maxrow) {
        newwin.data = ref_to(ptr_to(char), addr_of(alloc(
                               unsigned((newwin.maxrow * sizeof(ptr_to(char)))))));
        newwin.datlen = ref_to(short, addr_of(alloc(
                                unsigned((newwin.maxrow * sizeof(short))))));
        for (i = 0; i < newwin.maxrow; i++) {
            if (newwin.maxcol) { /* WIN_STATUS */
                newwin.data[i] = addr_of(alloc(unsigned(newwin.maxcol)));
                newwin.datlen[i] = short(newwin.maxcol);
            } else {
                newwin.data[i] = 0;
                newwin.datlen[i] = 0;
            }
        }
        if (newwin.type == NHW_MESSAGE)
            newwin.maxrow = 0;
    } else {
        newwin.data = null;
        newwin.datlen = null;
    }

    return newid;
}

function erase_menu_or_text(
    window,
    cw,
    clear) { /* void */
    if (cw.offx == 0) {
        if (cw.offy) {
            tty_curs(window, 1, 0);
            cl_eos();
        } else if (clear) {
            term_clear_screen();
        } else {
            docrt();
            flush_screen(1);
        }
    } else {
        docorner(cw.offx, cw.maxrow + 1, 0);
    }
}

function free_window_info(cw, free_data) { /* void */
    let i;

    if (cw.data) {
        if (WIN_MESSAGE != WIN_ERR && cw == wins[WIN_MESSAGE]
            && cw.rows > cw.maxrow)
            cw.maxrow = cw.rows; /* topl data */
        for (i = 0; i < cw.maxrow; i++)
            if (cw.data[i]) {
                free((cw.data[i]));
                cw.data[i] = 0;
                if (cw.datlen)
                    cw.datlen[i] = 0;
            }
        if (free_data) {
            free(addr_of(cw.data));
            cw.data = null;
            if (cw.datlen)
                free(addr_of(cw.datlen));
            cw.datlen = null;
            cw.rows = 0;
        }
    }
    cw.maxrow = cw.maxcol = 0;
    if (cw.mlist) {
        let temp;

        while ((temp = cw.mlist) != null) {
            cw.mlist = temp.next;
            if (temp.str)
                free(temp.str);
            free(addr_of(temp));
        }
    }
    if (cw.plist) {
        free(addr_of(cw.plist));
        cw.plist = null;
    }
    cw.plist_size = cw.npages = cw.nitems = cw.how = 0;
    if (cw.morestr) {
        free(cw.morestr);
        cw.morestr = 0;
    }
}

export function tty_clear_nhwindow(window) { /* void */
    let i, j, m, n;
    let cw = null;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (window == WIN_ERR || (cw = wins[window]) == null)
        panic(winpanicstr, window, _("tty_clear_nhwindow"));
    ttyDisplay.lastwin = window;

     ;

    switch (cw.type) {
    case NHW_MESSAGE:
        if (ttyDisplay.toplin != TOPLINE_EMPTY) {
            if (!erasing_tty_screen[0]) {
                home();
                cl_end();
                if (cw.cury)
                    docorner(1, cw.cury + 1, 0);
            }
            cw.curx = cw.cury = 0;
            ttyDisplay.toplin = TOPLINE_EMPTY;
        }
        break;
    case NHW_STATUS:
        m = cw.maxrow;
        n = cw.cols;
        for (i = 0; i < m; ++i) {
            if (!erasing_tty_screen[0]) {
                tty_curs(window, 1, i);
                cl_end();
            }
            for (j = 0; j < n - 1; ++j)
                chars[cw.data[i] + j] = ord(' ');
            chars[cw.data[i] + (n - 1)] = ord('\0');
            /*finalx[i][NOW] = finalx[i][BEFORE] = 0;*/
        }
        disp.botlx = TRUE;
        break;
    case NHW_MAP:
        /* cheap -- clear the whole thing and tell nethack to redraw botl */
        disp.botlx = TRUE;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case NHW_BASE:
        /* if erasing_tty_screen is True, calling sequence is
           term_clear_screen -> erase_tty_screen -> tty_clear_nhwindow
           so we don't call term_clear_screen again */
        if (!erasing_tty_screen[0]) {
            term_clear_screen();
        }
        /*
         * Neither map nor base window tracks what is currently shown so
         * there's no stale data that would need to be changed to spaces.
         */
        break;
    case NHW_MENU:
    case NHW_TEXT:

        if (!erasing_tty_screen[0]) {
            if (cw.active)
                erase_menu_or_text(window, cw, TRUE);

                free_window_info(cw, FALSE);
        }
        break;
    }
    cw.curx = cw.cury = 0;
    /* cw->blanked = TRUE; -- this isn't used */
}

/* toggle a specific entry */
function toggle_menu_curr(
    window,
    curr,
    lineno,
    in_view,
    counting,
    count) { /* boolean */
    if (curr.selected) {
        if (counting && count > 0) {
            curr.count = count;
            if (in_view)
                set_item_state(window, lineno, curr);
            return TRUE;
        } else { /* change state */
            curr.selected = FALSE;
            curr.count = -1;
            if (in_view)
                set_item_state(window, lineno, curr);
            return TRUE;
        }
    } else { /* !selected */
        if (counting && count > 0) {
            curr.count = count;
            curr.selected = TRUE;
            if (in_view)
                set_item_state(window, lineno, curr);
            return TRUE;
        } else if (!counting) {
            curr.selected = TRUE;
            if (in_view)
                set_item_state(window, lineno, curr);
            return TRUE;
        }
        /* do nothing counting&&count==0 */
    }
    return FALSE;
}

function dmore(
    cw,
    s) { /* void */ /* valid responses */
    let prompt = cw.morestr ? cw.morestr : defmorestr;
    let offset = (cw.type == NHW_TEXT) ? 1 : 2;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    tty_curs(BASE_WINDOW, ttyDisplay.curx + offset,
             ttyDisplay.cury);
    if (flags.standout)
        standoutbeg();
    xputs(prompt);

    { let save_cx = ttyDisplay.curx; let np; for (np = prompt; chars[np]; np++) { nomux_putch(chars[np]); ttyDisplay.curx++; } ttyDisplay.curx = save_cx; }

    ttyDisplay.curx += strlen(prompt);
    if (flags.standout)
        standoutend();

    xwaitforspace(s);
}

/* change screen display for selection state of an item;
   not used or wanted for items that aren't shown by the current page */
function set_item_state(
    window,
    lineno,
    item) { /* void */
    let ch = item.selected ? (item.count == -1 ? ord('+') : ord('#')) : ord('-');

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    tty_curs(window, 4, lineno);
    term_start_attr(item.attr);
    if (item.color != NO_COLOR)
        term_start_color(item.color);
    putchar(ch);

    nomux_putch(ch);

    ttyDisplay.curx++;
    if (item.color != NO_COLOR)
        term_end_color();
    term_end_attr(item.attr);
}

/* select all [ignores pending count, if any] */
function set_all_on_page(
    window,
    page_start,
    page_end) { /* void */
    let curr;
    let n;

    for (n = 0, curr = page_start; curr != page_end; n++, curr = curr.next) {
        if (!curr.identifier.a_void /* not selectable */
            || curr.selected /* already selected */
            || !menuitem_invert_test(1, curr.itemflags, FALSE))
            continue;
        curr.selected = TRUE;
        set_item_state(window, n, curr);
    }
}

/* unselect all */
function unset_all_on_page(
    window,
    page_start,
    page_end) { /* void */
    let curr;
    let n;

    for (n = 0, curr = page_start; curr != page_end; n++, curr = curr.next) {
        if (!curr.identifier.a_void /* skip if not selectable */
            || !curr.selected /* skip if already de-selected */
            || !menuitem_invert_test(2, curr.itemflags, TRUE))
            continue;
        curr.selected = FALSE;
        curr.count = -1;
        set_item_state(window, n, curr);
    }
}

/* invert current page */
function invert_all_on_page(
    window,
    page_start,
    page_end,
    acc,
    count) { /* void */ /* pending count; -1L for non-group toggling */
    let curr;
    let n;

    for (n = 0, curr = page_start; curr != page_end; n++, curr = curr.next) {
        if (!curr.identifier.a_void /* not selectable */
            || (acc ? curr.gselector != acc /* skip if not group 'acc' */
                /* inverting all rather than a group; skip if flagged */
                : !menuitem_invert_test(0, curr.itemflags, curr.selected)))
            continue;

        if (curr.selected) {
            curr.selected = FALSE;
            curr.count = -1;
        } else {
            curr.selected = TRUE;
            if (count > 0)
                curr.count = count;
        }
        set_item_state(window, n, curr);
    }
}

/* invert all entries that match given group accelerator (or all if zero) */
function invert_all(
    window,
    page_start,
    page_end,
    acc,
    count) { /* void */ /* pending count; -1L for non-group toggling */
    let curr;
    let on_curr_page;
    let cw = wins[window];

    /* handle current page separately (it will need screen updating) */
    invert_all_on_page(window, page_start, page_end, acc, count);

    /* invert the rest (no screen updating for them) */
    for (on_curr_page = FALSE, curr = cw.mlist; curr; curr = curr.next) {
        if (curr == page_start)
            on_curr_page = TRUE;
        else if (curr == page_end)
            on_curr_page = FALSE;

        /* skip if on current page (already handled above) or not
           selectable (header line or similar) or if group toggling
           is taking place and this item isn't in specified group or
           group toggling is not taking place and this item is off
           limits to bulk toggling (assumes that an item won't be
           both in a group and also subject to bulk restrictions) */
        if (on_curr_page || !curr.identifier.a_void
            || (acc ? curr.gselector != acc
                : !menuitem_invert_test(0, curr.itemflags, curr.selected)))
            continue;

        if (curr.selected) {
            curr.selected = FALSE;
            curr.count = -1;
        } else {
            curr.selected = TRUE;
            if (count > 0)
                curr.count = count;
        }
    }
}

/* support menucolor in addition to caller-supplied attribute */
function toggle_menu_attr(on, color, attr) { /* void */
    if (on) {
        term_start_attr(attr);
        if (color != NO_COLOR)
            term_start_color(color);
    } else {
        if (color != NO_COLOR)
            term_end_color();
        term_end_attr(attr);
    }
}

function process_menu_window(window, cw) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var resp = stack_array(char, QBUFSZ), gacc = stack_array(char, QBUFSZ), gcnt = stack_array(int, 128), searchbuf = stack_array(char, BUFSZ + 2), tmpbuf = stack_array(char, BUFSZ);
    var page_start, page_end, curr;
    var count;
    var n, attr_n, curr_page, page_lines, resp_len, previous_page_lines;
    var finished, counting, reset_count, show_obj_syms,
            only_if_no_headers = +((iflags.menuobjsyms & 4) != 0);
    var cp, rp, msave, morestr, really_morc;

    curr_page = page_lines = 0;
    page_start = page_end = null;
    msave = cw.morestr; /* save the morestr */
    cw.morestr = morestr = addr_of(alloc(QBUFSZ));
    counting = FALSE;
    count = 0;
    reset_count = TRUE;
    finished = FALSE;
    previous_page_lines = 0;

    /* collect group accelerators; for PICK_NONE, they're ignored;
       for PICK_ONE, only those which match exactly one entry will be
       accepted; for PICK_ANY, those which match any entry are okay */
    chars[gacc + 0] = ord('\0');
    if (cw.how != PICK_NONE) {
        var i;

        for (i = 0; i < SIZE(gcnt); i++)
            gcnt[i] = 0;
        for (n = 0, curr = cw.mlist; curr; curr = curr.next)
            if (curr.gselector && curr.gselector != curr.selector) {
                ++n;
                ++gcnt[GSELIDX(curr.gselector)];
            }

        if (n > 0) /* at least one group accelerator found */
            for (rp = gacc, curr = cw.mlist; curr; curr = curr.next)
                if (curr.gselector
                    && (curr.gselector != curr.selector
                        /* '$' is both a selector "letter" and a group
                           accelerator; including it in gacc allows gold to
                           be selected via group when not on current page */
                        || curr.gselector == GOLD_SYM)
                    && !strchr(gacc, curr.gselector)
                    && (cw.how == PICK_ANY
                        || gcnt[GSELIDX(curr.gselector)] == 1)) {
                    chars[rp++] = curr.gselector;
                    chars[rp] = ord('\0'); /* re-terminate for strchr() */
                }
    }
    resp_len = 0; /* lint suppression */

    show_obj_syms = iflags.use_menu_glyphs;
    if (only_if_no_headers) {
        for (curr = cw.mlist; curr; curr = curr.next)
            if (curr.identifier.a_void == 0) {
                show_obj_syms = FALSE;
                break;
            }
    }

    /* loop until finished */
    $out_group_accel: while (!finished) {
        do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
        if (reset_count) {
            counting = FALSE;
            count = 0;
        } else
            reset_count = TRUE;

        if (!page_start) {
            /* new page to be displayed */
            if (curr_page < 0 || (cw.npages > 0 && curr_page >= cw.npages))
                panic(_("bad menu screen page #%d"), curr_page);

            /* clear screen */
            if (!cw.offx) { /* if not corner, do clearscreen */
                if (cw.offy) {
                    tty_curs(window, 1, 0);
                    cl_eos();
                } else
                    term_clear_screen();
            }

            rp = resp;
            if (cw.npages > 0) {
                /* collect accelerators */
                page_start = cw.plist[curr_page];
                page_end = cw.plist[curr_page + 1];
                for (page_lines = 0, curr = page_start; curr != page_end;
                     page_lines++, curr = curr.next) {
                    var attr, color = NO_COLOR;

                    if (curr.selector)
                        chars[rp++] = curr.selector;

                    tty_curs(window, 1, page_lines);
                    if (cw.offx)
                        cl_end();

                    putchar(ord(' '));
                    ++ttyDisplay.curx;

                    attr = curr.attr;
                    color = curr.color;

                    /* which character to start attribute highlighting;
                       whole line for headers and such, after the selector
                       character and space and selection indicator for menu
                       lines (including fake ones that simulate grayed-out
                       entries, so we don't rely on curr->identifier here) */
                    attr_n = 0; /* whole line */
                    if (chars[curr.str + 0] && chars[curr.str + 1] == ord(' ')
                        && chars[curr.str + 2] && strchr(_("-+#"), chars[curr.str + 2])
                        && chars[curr.str + 3] == ord(' '))
                        /* [0]=letter, [1]=space, [2]=[-+#], [3]=space */
                        attr_n = 4; /* [4:N]=entry description */

                    /*
                     * Don't use xputs() because (1) under unix it calls
                     * tputstr() which will interpret a '*' as some kind
                     * of padding information and (2) it calls xputc to
                     * actually output the character.  We're faster doing
                     * this.
                     */
                    for (n = 0, cp = curr.str;
                         chars[cp] &&

                            (++ttyDisplay.curx) < ttyDisplay.cols;

                         cp++, n++) {
                        if (n == attr_n && (color != NO_COLOR
                                            || attr != ATR_NONE))
                            toggle_menu_attr(TRUE, color, attr);
                        if (n == 2 && curr.identifier.a_void != 0
                            && curr.selected) {
                            var c = (curr.count == -1) ? ord('*') : ord('#');

                            { var svx = ttyDisplay.curx; ttyDisplay.curx--; nomux_putch(c); ttyDisplay.curx = svx; }

                            /* all selected: '*' vs count selected: '#' */
                            putchar(c);
                        } else if (n == 2 && curr.identifier.a_void != 0
                                   && show_obj_syms
                                   && curr.glyphinfo.glyph != NO_GLYPH) {
                            var gcolor = curr.glyphinfo.gm.sym.color;

                            /* tty_print_glyph could be used, but is overkill
                               and requires referencing the cursor location */
                            toggle_menu_attr(TRUE, gcolor, ATR_NONE);
                            putchar(curr.glyphinfo.ttychar);

                            { var svx = ttyDisplay.curx; ttyDisplay.curx--; nomux_putch(curr.glyphinfo.ttychar); ttyDisplay.curx = svx; }

                            toggle_menu_attr(FALSE, gcolor, ATR_NONE);
                        } else {
                            putchar(chars[cp]);

                            { var svx = ttyDisplay.curx; ttyDisplay.curx--; nomux_putch(chars[cp]); ttyDisplay.curx = svx; }
                        }
                    } /* for *cp */
                    if (n > attr_n && (color != NO_COLOR || attr != ATR_NONE))
                        toggle_menu_attr(FALSE, color, attr);
                } /* if npages > 0 */
            } else {
                page_start = null;
                page_end = null;
                page_lines = 0;
            }
            chars[rp] = 0;
            /* remember how many explicit menu choices there are */
            resp_len = int(strlen(resp));

            /* corner window - clear extra lines from last page */
            if (cw.offx) {
                for (n = page_lines + 1; n < cw.maxrow; n++) {
                    tty_curs(window, 1, n);
                    cl_end();
                }
                /*
                 * If this corner menu was big, there are likely large
                 * portions of the map, status window, and tty perm_invent
                 * window (is there is one), that are all missing a lot of
                 * information. Let's repair the blacked-out rows now
                 * because it looks better.
                 */
                if (previous_page_lines != 0
                        && page_lines < previous_page_lines) {
                    /*
                     * +3 to leave a couple of blank rows
                     * under the menu to make it contrast well.
                     */
                    var row_startoffset = page_lines + 3;

                    if (row_startoffset > cw.maxrow - 1)
                        row_startoffset = cw.maxrow - 1;
                    docorner(cw.offx, cw.maxrow + 1, row_startoffset);
                }
            }
            /* set extra chars.. */
            if (chars[gacc]) {
                strcat(resp, gacc);             /* group accelerators */
                if (cw.how == PICK_ONE)
                    resp_len = int(strlen(resp));
            }
            strcat(resp, _(" "));                  /* next page or end */
            strcat(resp, _("0123456789\x1b\n\r")); /* counts, quit */
            strcat(resp, gm.mapped_menu_cmds);
            strcat(resp, default_menu_cmds);

            if (cw.npages > 1)
                sprintf(cw.morestr, _("(%d of %d)"), curr_page + 1, int(cw.npages));
            else if (msave)
                strcpy(cw.morestr, msave);
            else
                strcpy(cw.morestr, defmorestr)
;

            tty_curs(window, 1, page_lines);
            cl_end();
            dmore(cw, resp);
        } else {
            /* just put the cursor back... */
            tty_curs(window, int(strlen(cw.morestr)) + 2, page_lines);
            xwaitforspace(resp);
        }

        really_morc = morc; /* (only used with MENU_EXPLICIT_CHOICE) */
        if ((rp = strchr(resp, morc)) != 0 && rp < resp + resp_len)
            /* explicit menu selection; don't override it if it also
               happens to match a mapped menu command (such as ':' to
               look inside a container vs ':' to search) */
            morc = MENU_EXPLICIT_CHOICE;
        else
            morc = map_menu_cmd(morc);

        $goto_group_accel: for (;;) { switch ($goto || (morc)) {
        case ord('0'):
        case ord('1'):
        case ord('2'):
        case ord('3'):
        case ord('4'):
        case ord('5'):
        case ord('6'):
        case ord('7'):
        case ord('8'):
        case ord('9'):
            /* special case: '0' is also the default ball class;
               some menus use digits as potential group accelerators
               but their entries don't rely on counts */
            if (!counting && strchr(gacc, morc))
                { $goto = "group_accel"; continue $goto_group_accel; };

            {
                var dgt = (morc - ord('0'));

                /* count = (10 * count) + (morc - '0'); */
                count = AppendLongDigit(count, dgt);
                if (count < 0) /* overflow */
                    continue $out_group_accel; /* reset_count is True */
            }
            /*
             * It is debatable whether we should allow 0 to
             * start a count.  There is no difference if the
             * item is selected.  If not selected, then
             * "0b" could mean:
             *
             *  count starting zero:    "zero b's"
             *  ignore starting zero:   "select b"
             *
             * At present I don't know which is better.
             */
            if (count != 0) { /* ignore leading zeros */
                counting = TRUE;
                reset_count = FALSE;
            }
            break;
        case ord('\x1b'): /* cancel - from counting or loop */
            if (!counting) {
                /* deselect everything */
                for (curr = cw.mlist; curr; curr = curr.next) {
                    curr.selected = FALSE;
                    curr.count = -1;
                }
                cw.flags |= WIN_CANCELLED;
                finished = TRUE;
            }
            /* else only stop count */
            break;
        case ord('\0'): /* finished (commit) */
        case ord('\n'):
        case ord('\r'):
            finished = TRUE;
            break;
        case ord(' '):
        case MENU_NEXT_PAGE:
            if (cw.npages > 0 && curr_page != cw.npages - 1) {
                previous_page_lines = page_lines;
                curr_page++;
                page_start = null;
            } else if (morc == ord(' ')) {
                /* ' ' finishes menus here, but stop '>' doing the same. */
                finished = TRUE;
            }
            break;
        case MENU_PREVIOUS_PAGE:
            if (cw.npages > 0 && curr_page != 0) {
                --curr_page;
                page_start = null;
            }
            break;
        case MENU_FIRST_PAGE:
            if (cw.npages > 0 && curr_page != 0) {
                page_start = null;
                curr_page = 0;
            }
            break;
        case MENU_LAST_PAGE:
            if (cw.npages > 0 && curr_page != cw.npages - 1) {
                page_start = null;
                curr_page = cw.npages - 1;
            }
            break;
        case MENU_SELECT_PAGE:
            if (cw.how == PICK_ANY)
                set_all_on_page(window, page_start, page_end);
            break;
        case MENU_UNSELECT_PAGE:
            unset_all_on_page(window, page_start, page_end);
            break;
        case MENU_INVERT_PAGE:
            if (cw.how == PICK_ANY)
                invert_all_on_page(window, page_start, page_end, 0, -1);
            break;
        case MENU_SELECT_ALL:
            if (cw.how == PICK_ANY) {
                /* entries on the current page need screen updating */
                set_all_on_page(window, page_start, page_end);
                /* set the rest; entries on current page will be skipped
                   because all of those will be 'already selected' now
                   (some won't be if they failed menuitem_invert_test()
                   in set_all_on_page() but those will fail it again here) */
                for (curr = cw.mlist; curr; curr = curr.next) {
                    if (!curr.identifier.a_void /* not selectable */
                        || curr.selected /* already selected */
                        /* FALSE: not currently selected */
                        || !menuitem_invert_test(1, curr.itemflags, FALSE))
                        continue;
                    curr.selected = TRUE;
                }
            } /* if PICK_ANY */
            break;
        case MENU_UNSELECT_ALL:
            /* entries on the current page need screen updating */
            unset_all_on_page(window, page_start, page_end);
            /* unset the rest; entries on current page will be skipped
               because none of those will still be in 'selected' state
               (unless they failed the menuitem_invert_test() in
               unset_all_on_page() but those will fail it again here) */
            for (curr = cw.mlist; curr; curr = curr.next) {
                if (!curr.identifier.a_void /* not selectable */
                    || !curr.selected /* already de-selected */
                    /* TRUE: currently selected */
                    || !menuitem_invert_test(2, curr.itemflags, TRUE))
                    continue;
                curr.selected = FALSE;
                curr.count = -1;
            }
            break;
        case MENU_INVERT_ALL:
            if (cw.how == PICK_ANY)
                invert_all(window, page_start, page_end, 0, -1);
            break;
        case MENU_SEARCH:
            if (cw.how == PICK_NONE) {
                tty_nhbell();
                break;
            } else {
                init_list(tmpbuf, []);
                var on_curr_page = FALSE;
                var lineno = 0;

                tty_getlin(_("Search for:"), tmpbuf);
                if (!chars[tmpbuf + 0] || chars[tmpbuf + 0] == ord('\x1b'))
                    break;
                sprintf(searchbuf, _("*%s*"), tmpbuf);

                for (curr = cw.mlist; curr; curr = curr.next) {
                    if (on_curr_page)
                        lineno++;
                    if (curr == page_start)
                        on_curr_page = TRUE;
                    else if (curr == page_end)
                        on_curr_page = FALSE;
                    if (curr.identifier.a_void
                        && pmatchi(searchbuf, curr.str)) {
                        toggle_menu_curr(window, curr, lineno, on_curr_page,
                                         counting, count);
                        if (cw.how == PICK_ONE) {
                            finished = TRUE;
                            break;
                        }
                    }
                }
            }
            break;
        case MENU_EXPLICIT_CHOICE:
            morc = really_morc;
            /* FALLTHROUGH */;
        /*FALLTHRU*/
        case "group_accel": default:
            if (!$goto && (cw.how == PICK_NONE || !strchr(resp, morc))) {
                /* unacceptable input received */
                tty_nhbell();
                break;
            } else if ($goto || (strchr(gacc, morc))) {
 $goto = null;
                /* group accelerator; for the PICK_ONE case, we know that
                   it matches exactly one item in order to be in gacc[] */
                invert_all(window, page_start, page_end, morc,
                           counting ? count : -1);
                if (cw.how == PICK_ONE)
                    finished = TRUE;
                break;
            }
            /* find, toggle, and possibly update */
            for (n = 0, curr = page_start; curr != page_end;
                 n++, curr = curr.next)
                if (morc == curr.selector) {
                    toggle_menu_curr(window, curr, n, TRUE, counting, count);
                    if (cw.how == PICK_ONE)
                        finished = TRUE;
                    break; /* from `for' loop */
                }
            break;
        } break; }
    } /* while */
    cw.morestr = msave;
    free(morestr);
    } finally { stack_pop($frame); }
}
export function GSELIDX(c) { return (c & 127); }
export const MENU_EXPLICIT_CHOICE = 0x7f;

function process_text_window(window, cw) { /* void */
    let i, n, attr;
    let linestart;
    let cp;

    if (cw.type == NHW_TEXT && !cw.offx) {
        /* the window covers the whole screen */
        nomux_clear_screen();
    }

    for (n = 0, i = 0; i < cw.maxrow; i++) {
        do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
        if (!cw.offx && (n + cw.offy == ttyDisplay.rows - 1)) {
            tty_curs(window, 1, n);
            cl_end();
            dmore(cw, quitchars);
            if (morc == ord('\x1b')) {
                cw.flags |= WIN_CANCELLED;
                break;
            }
            if (cw.offy) {
                tty_curs(window, 1, 0);
                cl_eos();
            } else
                term_clear_screen();
            if (cw.type == NHW_TEXT && !cw.offx)
                nomux_clear_screen();
            n = 0;
        }
        tty_curs(window, 1, n++);

        cl_end();

        if (cw.data[i]) {
            attr = chars[cw.data[i] + 0] - 1;
            if (cw.offx) {
                putchar(ord(' '));

                nomux_putch(ord(' '));

                ++ttyDisplay.curx;
            }
            term_start_attr(attr);
            for (cp = cw.data[i] + 1, linestart = TRUE;

                 chars[cp] && (++ttyDisplay.curx) < ttyDisplay.cols;
                 cp++

                 ) {
                /* message recall for msg_window:full/combination/reverse
                   might have output from '/' in it (see redotoplin()) */
                if (linestart) {
                    if (SYMHANDLING(H_UTF8)) {
                        /* FIXME: what is actually in that line? is it the \GNNNNNNNN or UTF-8? */
                        g_putch(chars[cp]);
                    } else if ((chars[cp] & 0x80) != 0) {
                        g_putch(chars[cp]);
                        end_glyphout();
                    } else {
                        putchar(chars[cp]);

                        { let svx = ttyDisplay.curx; ttyDisplay.curx--; nomux_putch(chars[cp]); ttyDisplay.curx = svx; }
                    }
                    linestart = FALSE;
                } else {
                    putchar(chars[cp]);

                    { let svx = ttyDisplay.curx; ttyDisplay.curx--; nomux_putch(chars[cp]); ttyDisplay.curx = svx; }
                }
            }
            term_end_attr(attr);
        }
    }
    if (i == cw.maxrow) {
        if (cw.type == NHW_TEXT) {
            tty_curs(BASE_WINDOW, 1, ttyDisplay.cury + 1);
            cl_eos();
        }

        tty_curs(BASE_WINDOW, cw.offx + 1,
                 (cw.type == NHW_TEXT) ? ttyDisplay.rows - 1 : n);
        cl_end();
        dmore(cw, quitchars);
        if (morc == ord('\x1b'))
            cw.flags |= WIN_CANCELLED;
    }
}

/*ARGSUSED*/
export function tty_display_nhwindow(
    window,
    blocking) { /* void */ /* with ttys, all windows are blocking */
    let cw = null;
    let s_maxcol;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (window == WIN_ERR || (cw = wins[window]) == null)
        panic(winpanicstr, window, _("tty_display_nhwindow"));
    if (cw.flags & WIN_CANCELLED)
        return;
    ttyDisplay.lastwin = window;
    ttyDisplay.rawprint = 0;

     ;

    switch (cw.type) {
    case NHW_MESSAGE:
        if (ttyDisplay.toplin == TOPLINE_NEED_MORE) {
            more();
            ttyDisplay.toplin = TOPLINE_NEED_MORE; /* more resets this */
            tty_clear_nhwindow(window);
            ((!!(ttyDisplay.toplin == TOPLINE_EMPTY)) || (nhassert_failed(_("ttyDisplay->toplin == TOPLINE_EMPTY"), _(__FILE__), 0), 0));
        } else
            ttyDisplay.toplin = TOPLINE_EMPTY;
        cw.curx = cw.cury = 0;
        if (!cw.active)
            iflags.window_inited = TRUE;
        break;
    case NHW_MAP:
        end_glyphout();
        if (blocking) {
            if (ttyDisplay.toplin != TOPLINE_EMPTY)
                ttyDisplay.toplin = TOPLINE_NEED_MORE;
            tty_display_nhwindow(WIN_MESSAGE, TRUE);
            return;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case NHW_BASE:
        fflush(stdout);
        break;
    case NHW_TEXT:
        cw.maxcol = ttyDisplay.cols; /* force full-screen mode */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case NHW_MENU:
        cw.active = 1;
        /* cw->maxcol is a long, but its value is constrained to
           be <= ttyDisplay->cols, so is sure to fit within a short */
        s_maxcol = short(cw.maxcol);

        cw.offx = (cw.type == NHW_TEXT)
                       ? 0
                       : min(min(82, Math.trunc(ttyDisplay.cols / 2)),
                             ttyDisplay.cols - s_maxcol - 1);

        if (cw.offx < 0)
            cw.offx = 0;
        if (cw.type == NHW_MENU)
            cw.offy = 0;
        if (ttyDisplay.toplin == TOPLINE_NEED_MORE)
            tty_display_nhwindow(WIN_MESSAGE, TRUE);

        if (cw.maxrow >= ttyDisplay.rows
            || !iflags.menu_overlay)

        {
            cw.offx = 0;
            if (cw.offy || iflags.menu_overlay) {
                tty_curs(window, 1, 0);
                cl_eos();
            } else
                term_clear_screen();
            ttyDisplay.toplin = TOPLINE_EMPTY;
            nomux_clear_screen();
        } else {
            if (WIN_MESSAGE != WIN_ERR)
                tty_clear_nhwindow(WIN_MESSAGE);
        }

        if (cw.data || !cw.maxrow)
            process_text_window(window, cw);
        else
            process_menu_window(window, cw);
        break;
    }
    cw.active = 1;
}

export function tty_dismiss_nhwindow(window) { /* void */
    let cw = null;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (window == WIN_ERR || (cw = wins[window]) == null)
        panic(winpanicstr, window, _("tty_dismiss_nhwindow"));

     ;

    switch (cw.type) {
    case NHW_MESSAGE:
        if (ttyDisplay.toplin != TOPLINE_EMPTY)
            tty_display_nhwindow(WIN_MESSAGE, TRUE);
        ((!!(ttyDisplay.toplin == TOPLINE_EMPTY)) || (nhassert_failed(_("ttyDisplay->toplin == TOPLINE_EMPTY"), _(__FILE__), 0), 0));
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case NHW_STATUS:
    case NHW_BASE:
    case NHW_MAP:
        /*
         * these should only get dismissed when the game is going away
         * or suspending
         */
        tty_curs(BASE_WINDOW, 1, ttyDisplay.rows - 1);
        cw.active = 0;
        break;
    case NHW_MENU:
    case NHW_TEXT:
    case NHW_PERMINVENT:
        if (cw.active) {
            /* skip erasure if window_inited has been reset to 0 during
               final run-down in case this is the end-of-game window;
               the contents of that window should remain shown even when
               the window itself has gone away */
            if (iflags.window_inited && !erasing_tty_screen[0]) {
                let clearscreen = FALSE; /* just erase the menu */

                /* during role/race/&c selection, menus are put up on top
                   of the base window; we don't track what was there so
                   can't refresh--force the screen to be cleared instead
                   (affects dismissal of 'reset role filtering' menu if
                   screen height forces that to need a second page) */
                if (program_state.in_role_selection)
                    clearscreen = TRUE;

                erase_menu_or_text(window, cw, clearscreen);
            }
            cw.active = 0;
        }
        break;
    }
    cw.flags = 0;
}

export function tty_destroy_nhwindow(window) { /* void */
    let cw = null;

    if (window == WIN_ERR || (cw = wins[window]) == null) {
        if (window == WIN_INVEN) /* Null wins[WIN_INVEN] is tolerated */
            return;
        panic(winpanicstr, window, _("tty_destroy_nhwindow"));
    }

    if (cw.active)
        tty_dismiss_nhwindow(window);
    if (cw.type == NHW_MESSAGE)
        iflags.window_inited = 0;
    if (cw.type == NHW_MAP)
        term_clear_screen();

    free_window_info(cw, TRUE);
    free(addr_of(cw));
    wins[window] = null; /* available for re-use */
}

/* when screen is cleared, reset stored data to spaces */
export function erase_tty_screen() { /* void */
    let cw;
    let i;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (erasing_tty_screen[0]++)
        return;

    /* update window data to reflect that each active window is all blanks */
    for (i = 0; i < MAXWIN; ++i) {
        cw = wins[i];
        if (cw && cw.active)
            tty_clear_nhwindow(i);
    }
    tty_curs(BASE_WINDOW, 1, 0);
    erasing_tty_screen[0] = 0;
}

export function tty_curs(
    window,
    x, y) { /* void */ /* coordinates (and curx-x) must be signed */
    let cw = null;
    let cx = ttyDisplay.curx;
    let cy = ttyDisplay.cury;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (window == WIN_ERR || (cw = wins[window]) == null)
        panic(winpanicstr, window, _("tty_curs"));
    ttyDisplay.lastwin = window;

     ;

    if (x < 1 || y < 0 || y >= cw.rows || x > cw.cols) {
        let s = _("[unknown type]");

        switch (cw.type) {
        case NHW_MESSAGE:
            s = _("[topl window]");
            break;
        case NHW_STATUS:
            s = _("[status window]");
            break;
        case NHW_MAP:
            s = _("[map window]");
            break;
        case NHW_MENU:
            s = _("[corner window]");
            break;
        case NHW_TEXT:
            s = _("[text window]");
            break;
        case NHW_BASE:
            s = _("[base window]");
            break;
        }
        /* avoid sending a line to the message window if we're complaining
           about cursor positioning in message window; perhaps raw_printf?
           this ought to be using impossible() so that someone might
           actually see it */
        if (cw.type != NHW_MESSAGE)
            debugpline4(_("tty_curs: bad positioning win %d %s <%d,%d>"),
                        window, s, x, y, __FILE__);
        /* don't try to fix up x,y here because then tty_curs() would
           behave differently depending on whether DEBUG is defined;
           garbage in, garbage out is the order of the day... */
    }

    cw.curx = --x; /* column 0 is not used */
    cw.cury = y;

    x += cw.offx;
    y += cw.offy;

    if (clipping[0] && window == WIN_MAP) {
        x -= clipx[0];
        y -= clipy[0];
    }

    if (y == cy && x == cx)
        return;

    if (cw.type == NHW_MAP)
        end_glyphout();

    if (!nh_ND() && (cx != x || x <= 3)) { /* Extremely primitive */
        cmov(x, y);                      /* bunker!wtm */
        return;
    }

    if ((cy -= y) < 0)
        cy = -cy;
    if ((cx -= x) < 0)
        cx = -cx;
    if (cy <= 3 && cx <= 3) {
        nocmov(x, y);
    } else if ((x <= 3 && cy <= 3) || (!nh_CM() && x < cx)) {
        putchar(ord('\r'));
        ttyDisplay.curx = 0;
        nocmov(x, y);
    } else if (!nh_CM()) {
        nocmov(x, y);
    } else
        cmov(x, y);

    ttyDisplay.curx = x;
    ttyDisplay.cury = y;
}

/* #ifndef STATUS_HILITES: not in this build */

function compress_str(str) { /* const char * */
    let cbuf = static_array("compress_str.cbuf", char, BUFSZ);

    /* compress out consecutive spaces if line is too long;
       topline wrapping converts space at wrap point into newline,
       we reverse that here */
    if (int(strlen(str)) >= CO() || strchr(str, ord('\n'))) {
        let in_str = str;
        let c, outstr = cbuf, outend = cbuf + (sizeof(array_of(char, BUFSZ)) - 1);
        let was_space = TRUE; /* True discards all leading spaces;
                                     False would retain one if present */

        while ((c = chars[in_str++]) != ord('\0') && outstr < outend) {
            if (c == ord('\n'))
                c = ord(' ');
            if (was_space && c == ord(' '))
                continue;
            chars[outstr++] = c;
            was_space = +(c == ord(' '));
        }
        if ((was_space && outstr > cbuf) || outstr == outend)
            --outstr; /* remove trailing space or make room for terminator */
        chars[outstr] = ord('\0');
        str = cbuf;
    }
    return str;
}

export function tty_putstr(window, attr, str) { /* void */
    let cw = null;
    let ob;
    let i, n0;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    /* Assume there's a real problem if the window is missing --
     * probably a panic message
     */
    if (window == WIN_ERR || (cw = wins[window]) == null) {
        tty_raw_print(str);
        return;
    }

    if (str == 0
        || ((cw.flags & WIN_CANCELLED) && (cw.type != NHW_MESSAGE)))
        return;
    if (cw.type != NHW_MESSAGE

       )
        str = compress_str(str);

    ttyDisplay.lastwin = window;

     ;

    switch (cw.type) {
    case NHW_MESSAGE: {
        let suppress_history = (attr & ATR_NOHISTORY),
            urgent_message = (attr & ATR_URGENT);

        /* if ^C occurs, player is prompted with "Really quit?" and that
           prompt is issued via tty_putstr(WIN_MESSAGE); if ^C happens
           while writing DECgraphics chars, the prompt text would be
           rendered as VT line-drawing characters unless we do this;
           also, if color was in progress it wouldn't be switched off */
        end_glyphout();

        /* if message is designated 'urgent' don't suppress it if user has
           typed ESC at --More-- prompt when dismissing an earlier message;
           besides turning off WIN_STOP, we need to prevent current message
           from provoking --More-- and giving the user another chance at
           using ESC to suppress, otherwise this message wouldn't get shown */
        if (urgent_message) {
            if ((cw.flags & WIN_STOP) != 0) {
                tty_clear_nhwindow(WIN_MESSAGE);
                cw.flags &= ~WIN_STOP;
            }
            cw.flags |= WIN_NOSTOP;
        }

        /* in case we ever support display attributes for topline
           messages, clear flag mask leaving only display attr */
        /*attr &= ~(ATR_URGENT | ATR_NOHISTORY);*/

        if (!suppress_history) {
            /* normal output; add to current top line if room, else flush
               whatever is there to history and then write this */
            update_topl(str);
        } else {
            /* put anything already on top line into history */
            remember_topl();
            /* write to top line without remembering what we're writing */
            show_topl(str);
        }

        cw.flags &= ~WIN_NOSTOP; /* NOSTOP is a one-shot operation */
        break;
    }
    /* #ifndef STATUS_HILITES: not in this build */

    case NHW_MAP:
        tty_curs(window, cw.curx + 1, cw.cury);
        term_start_attr(attr);
        while (chars[str] && ttyDisplay.curx < ttyDisplay.cols - 1) {
            putchar(chars[str]);

            nomux_putch(chars[str]);

            str++;
            ttyDisplay.curx++;
        }
        cw.curx = 0;
        cw.cury++;
        term_end_attr(attr);
        break;
    case NHW_BASE:
        tty_curs(window, cw.curx + 1, cw.cury);
        term_start_attr(attr);
        while (chars[str]) {
            if (ttyDisplay.curx >= ttyDisplay.cols - 1) {
                cw.curx = 0;
                cw.cury++;
                tty_curs(window, cw.curx + 1, cw.cury);
            }
            putchar(chars[str]);

            nomux_putch(chars[str]);

            str++;
            ttyDisplay.curx++;
        }
        cw.curx = 0;
        cw.cury++;
        term_end_attr(attr);
        break;
    case NHW_MENU:
    case NHW_TEXT:

        if (cw.type == NHW_TEXT
            && (cw.cury + cw.offy) == ttyDisplay.rows - 1)

        {
            /* not a menu, so save memory and output 1 page at a time */
            cw.maxcol = ttyDisplay.cols; /* force full-screen mode */
            tty_display_nhwindow(window, TRUE);
            for (i = 0; i < cw.maxrow; i++)
                if (cw.data[i]) {
                    free((cw.data[i]));
                    cw.data[i] = 0;
                }
            cw.maxrow = cw.cury = 0;
        }
        /* always grows one at a time, but alloc 12 at a time */
        if (cw.cury >= cw.rows) {
            let tmp;

            cw.rows += 12;
            tmp = ref_to(ptr_to(char), addr_of(alloc(unsigned(Math.imul(sizeof(ptr_to(char)), unsigned(cw.rows))))));
            for (i = 0; i < cw.maxrow; i++)
                tmp[i] = cw.data[i];
            if (cw.data)
                free(addr_of(cw.data));
            cw.data = tmp;

            for (i = cw.maxrow; i < cw.rows; i++)
                cw.data[i] = 0;
        }
        if (cw.data[cw.cury])
            free((cw.data[cw.cury]));
        n0 = strlen(str) + 1;
        ob = cw.data[cw.cury] = addr_of(alloc(unsigned(unsigned(n0) + 1)));
        chars[ob++] = char((attr + 1)); /* avoid nuls, for convenience */
        strcpy(ob, str);

        if (n0 > cw.maxcol)
            cw.maxcol = n0;
        if (++cw.cury > cw.maxrow)
            cw.maxrow = cw.cury;
        if (n0 > CO()) {
            /* attempt to break the line */
            for (i = CO() - 1; i && chars[str + i] != ord(' ') && chars[str + i] != ord('\n');)
                i--;
            if (i) {
                chars[cw.data[cw.cury - 1] + (++i)] = ord('\0');
                tty_putstr(window, attr, str + i);
            }
        }
        break;
    }
    return;
}

export function tty_display_file(
    fname,
    complain) { /* void */ /* whether to report problem if file can't be opened */
    const $frame = stack_frame(); try {
    /* #ifdef DEF_PAGER: not in this build */

    {
        let f;
        let buf = stack_array(char, BUFSZ);
        let cr;

        tty_clear_nhwindow(WIN_MESSAGE);
        f = dlb_fopen(fname, _("r"));
        if (!f) {
            if (complain) {
                home();
                tty_mark_synch();
                tty_raw_print(_(""));
                perror(fname);
                tty_wait_synch(); /* "Hit <space> to continue: " */
                if (u.ux) /* if hero is on map, refresh the screen */
                    docrt();
                pline(_("Cannot open \"%s\"."), fname);
            }
        } else {
            let datawin = tty_create_nhwindow(NHW_TEXT);
            let empty = TRUE;

            if (complain

                && nh_CD()

                ) {
                /* attempt to scroll text below map window if there's room */
                wins[datawin].offy = wins[WIN_STATUS].offy + StatusRows();
                if ((wins[datawin].offy) + 12 > ttyDisplay.rows)
                    wins[datawin].offy = 0;
            }
            while (dlb_fgets(buf, BUFSZ, f)) {
                if ((cr = strchr(buf, ord('\n'))) != 0)
                    chars[cr] = 0;

                if (strchr(buf, ord('\t')) != 0)
                    tabexpand(buf);
                empty = FALSE;
                tty_putstr(datawin, 0, buf);
                if (wins[datawin].flags & WIN_CANCELLED)
                    break;
            }
            if (!empty)
                tty_display_nhwindow(datawin, FALSE);
            tty_destroy_nhwindow(datawin);
            dlb_fclose(f);
        }
    }

    return;
    } finally { stack_pop($frame); }
}

export function tty_start_menu(window, mbehavior) { /* void */
    let cw = null;

    if (window == WIN_ERR || (cw = wins[window]) == null)
        panic(winpanicstr, window, _("tty_start_menu"));

    /* #ifdef TTY_PERM_INVENT: not in this build */

    (mbehavior);

    tty_clear_nhwindow(window);
    return;
}

    /*ARGSUSED*/
/*
 * Add a menu item to the beginning of the menu list.  This list is reversed
 * later.
 */
export function tty_add_menu(
    window,
    glyphinfo,

    identifier,
    ch,
    gch,
    attr,
    clr,
    str,
    itemflags) { /* void */ /* itemflags such as MENU_ITEMFLAGS_SELECTED */
    const $frame = stack_frame(); try {
    let preselected = +((itemflags & MENU_ITEMFLAGS_SELECTED) != 0);
    let cw = null;
    let item;
    let newstr;
    let buf = stack_array(char, 4 + BUFSZ);

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (str == 0)
        return;

    if (window == WIN_ERR
        || (cw = wins[window]) == null
        || cw.type != NHW_MENU)
        panic(winpanicstr, window, _("tty_add_menu"));

    cw.nitems++;
    if (identifier.a_void) {
        let len = int(strlen(str));

        if (len >= BUFSZ) {
            /* We *think* everything's coming in off at most BUFSZ bufs... */
            impossible(_("Menu item too long (%d)."), len);
            len = BUFSZ - 1;
        }
        sprintf(buf, _("%c - "), ch ? ch : ord('?'));
        strncpy(buf + 4, str, unsigned(len));
        chars[buf + (4 + len)] = ord('\0');
        newstr = buf;
    } else
        newstr = str;

    item = view_of(struct_tty_mi, addr_of(alloc(sizeof(struct_tty_mi))));
    struct_assign(item.identifier, identifier);
    item.count = -1;
    item.selected = preselected;
    item.itemflags = itemflags;
    item.selector = ch;
    item.gselector = gch;
    item.attr = attr;
    item.color = clr;
    item.str = dupstr(newstr);
    struct_assign(item.glyphinfo, glyphinfo);

    item.next = cw.mlist;
    cw.mlist = item;
    } finally { stack_pop($frame); }
}

/* Invert the given list, can handle NULL as an input. */
function reverse(curr) { /* tty_menu_item * */
    let next, head = null;

    while (curr) {
        next = curr.next;
        curr.next = head;
        head = curr;
        curr = next;
    }
    return head;
}

const tty_menu_promptstyle = static_struct("tty_menu_promptstyle", struct_color_and_attr, { color: NO_COLOR, attr: ATR_NONE });

/*
 * End a menu in this window, window must a type NHW_MENU.  This routine
 * processes the string list.  We calculate the # of pages, then assign
 * keyboard accelerators as needed.  Finally we decide on the width and
 * height of the window.
 */
export function tty_end_menu(
    window,
    prompt) { /* void */ /* prompt to for menu */
    const $frame = stack_frame(); try {
    let cw = null;
    let curr;
    let len;
    let lmax, n;
    let menu_ch;
    let clr = NO_COLOR;

    if (window == WIN_ERR || (cw = wins[window]) == null
        || cw.type != NHW_MENU) {
        /* this can happen if start_menu failed due to size requirements
           for the tty perm inventory window. It isn't a situation that
           requires a panic, just an early return. */
        if (window == WIN_INVEN && !cw)
            return;
        panic(winpanicstr, window, _("tty_end_menu"));
    }

    /* Reverse the list so that items are in correct order. */
    cw.mlist = reverse(cw.mlist);

    /* Put the prompt at the beginning of the menu. */
    if (prompt) {
        let any = stack_struct(struct_any);

        struct_assign(any, cg.zeroany); /* not selectable */
        tty_add_menu(window, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, clr, _(""), MENU_ITEMFLAGS_NONE);
        tty_add_menu(window, nul_glyphinfo, any, 0, 0,
                     tty_menu_promptstyle.attr, tty_menu_promptstyle.color,
                     prompt, MENU_ITEMFLAGS_NONE);
    }

    /* 52: 'a'..'z' and 'A'..'Z'; avoids selector duplication within a page */
    lmax = min(52, ttyDisplay.rows - 1);    /* # lines per page */
    cw.npages = Math.trunc((cw.nitems + (lmax - 1)) / lmax); /* # of pages */
    /*
     * TODO?
     *  For really tall page, allow 53 if '$' or '#' is present and
     *  54 if both are.  [Only for single page menu, otherwise pages
     *  without those could try to use too many letters.]
     *  Probably not worth bothering with; anyone with a display big
     *  for this to matter will likely switch from tty to curses for
     *  multi-line message window and/or persistent inventory window.
     */

    /* make sure page list is large enough */
    if (cw.plist_size < cw.npages + 1) { /* +1: need one slot beyond last */
        if (cw.plist)
            free(addr_of(cw.plist));
        cw.plist_size = cw.npages + 1;
        cw.plist = ref_to(ptr_to(struct_tty_mi), addr_of(alloc(unsigned(cw.plist_size
                                             * sizeof(ptr_to(struct_tty_mi))))));
    }

    cw.cols = 0;  /* cols is set when the win is initialized... (why?) */
    menu_ch = ord('?'); /* lint suppression */
    for (n = 0, curr = cw.mlist; curr; n++, curr = curr.next) {
        /* set page boundaries and character accelerators */
        if ((n % lmax) == 0) {
            menu_ch = ord('a');
            cw.plist[Math.trunc(n / lmax)] = curr;
        }
        if (curr.identifier.a_void && !curr.selector) {
            chars[curr.str + 0] = curr.selector = menu_ch;
            if (menu_ch++ == ord('z'))
                menu_ch = ord('A');
        }

        /* cut off any lines that are too long */
        len = short(unsigned(strlen(curr.str) + 2)); /* extra space at beg & end */
        if (len > ttyDisplay.cols) {
            chars[curr.str + (ttyDisplay.cols - 2)] = 0;
            len = ttyDisplay.cols;
        }
        if (len > cw.cols)
            cw.cols = len;
    }
    cw.plist[cw.npages] = null; /* plist terminator */

    /*
     * If greater than 1 page, morestr is "(x of y) " otherwise, "(end) "
     */
    if (cw.npages > 1) {
        let buf = stack_array(char, QBUFSZ);
        /* produce the largest demo string */
        sprintf(buf, _("(%lld of %lld) "), cw.npages, cw.npages);
        len = short(strlen(buf));
        cw.morestr = dupstr(_(""));
    } else {
        cw.morestr = dupstr(_("(end) "));
        len = short(strlen(cw.morestr));
    }

    if (len > ttyDisplay.cols) {
        /* truncate the prompt if it's too long for the screen */
        if (cw.npages <= 1) /* only str in single page case */
            chars[cw.morestr + ttyDisplay.cols] = 0;
        len = ttyDisplay.cols;
    }
    if (len > cw.cols)
        cw.cols = len;

    cw.maxcol = cw.cols;

    /*
     * The number of lines in the first page plus the morestr will be the
     * maximum size of the window.
     */
    if (cw.npages > 1)
        cw.maxrow = cw.rows = lmax + 1;
    else
        cw.maxrow = cw.rows = cw.nitems + 1;
    } finally { stack_pop($frame); }
}

export function tty_select_menu(window, how, menu_list) { /* int */
    let cw = null;
    let curr;
    let mi;
    let n, cancelled;

    if (window == WIN_ERR || (cw = wins[window]) == null
        || cw.type != NHW_MENU)
        panic(winpanicstr, window, _("tty_select_menu"));

    if (cw.mbehavior == MENU_BEHAVE_PERMINV) {
        return 0;
    }
    menu_list[0] = null;
    cw.how = short(how);
    morc = 0;
    tty_display_nhwindow(window, TRUE);
    cancelled = +!!(cw.flags & WIN_CANCELLED);
    tty_dismiss_nhwindow(window); /* does not destroy window data */

    if (cancelled) {
        n = -1;
    } else {
        for (n = 0, curr = cw.mlist; curr; curr = curr.next)
            if (curr.selected)
                n++;
    }

    if (n > 0) {
        menu_list[0] = view_of(struct_mi, addr_of(alloc(unsigned(Math.imul(unsigned(n), sizeof(struct_mi))))));
        for (mi = menu_list[0], curr = cw.mlist; curr; curr = curr.next)
            if (curr.selected) {
                struct_assign(mi.item, curr.identifier);
                mi.count = curr.count;
                mi = ptr_add(mi, 1);
            }
    }

    return n;
}

/* special hack for treating top line --More-- as a one item menu */
export function tty_message_menu(let_, how, mesg) { /* char */
    do { if (program_state.done_hup) return (ord('\x1b')); } while (0);
    /* "menu" without selection; use ordinary pline, no more() */
    if (how == PICK_NONE) {
        pline(_("%s"), mesg);
        return 0;
    }

    ttyDisplay.dismiss_more = let_;
    morc = 0;
    /* barebones pline(); since we're only supposed to be called after
       response to a prompt, we'll assume that the display is up to date */
    tty_putstr(WIN_MESSAGE, 0, mesg);
    /* if `mesg' didn't wrap (triggering --More--), force --More-- now */
    if (ttyDisplay.toplin == TOPLINE_NEED_MORE) {
        more();
        ttyDisplay.toplin = TOPLINE_NEED_MORE; /* more resets this */
        tty_clear_nhwindow(WIN_MESSAGE);
        ((!!(ttyDisplay.toplin == TOPLINE_EMPTY)) || (nhassert_failed(_("ttyDisplay->toplin == TOPLINE_EMPTY"), _(__FILE__), 0), 0));
    }
    /* normally <ESC> means skip further messages, but in this case
       it means cancel the current prompt; any other messages should
       continue to be output normally */
    wins[WIN_MESSAGE].flags &= ~WIN_CANCELLED;
    ttyDisplay.dismiss_more = 0;

    return ((how == PICK_ONE && morc == let_) || morc == ord('\x1b')) ? morc : ord('\0');
}

export function tty_ctrl_nhwindow(
    window,
    request,
    wri) { /* win_request_info * */
    if (!wri)
        return null;

    switch (request) {
    case set_mode:
    case request_settings:
        /* #if defined(TTY_PERM_INVENT): not in this build */

        break;
    case set_menu_promptstyle:
        struct_assign(tty_menu_promptstyle, wri.fromcore.menu_promptstyle);
        break;
    default:
        break;
    }
    return wri;
}

/* #ifdef TTY_PERM_INVENT: not in this build */

/* update persistent inventory window */
export function tty_update_inventory(arg) { /* void */
    /* do nothing */

    return;
}

export function tty_mark_synch() { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    fflush(stdout);
}

export function tty_wait_synch() { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    /* we just need to make sure all windows are synch'd */
    if (WIN_MAP == WIN_ERR || !ttyDisplay || ttyDisplay.rawprint) {
        getret();
        if (ttyDisplay)
            ttyDisplay.rawprint = 0;
    } else {
        tty_display_nhwindow(WIN_MAP, FALSE);
        if (ttyDisplay.inmore) {
            addtopl(_("--More--"));
            fflush(stdout);
        } else if (ttyDisplay.inread > program_state.gameover) {
            /* this can only happen if we were reading and got interrupted */
            ttyDisplay.toplin = TOPLINE_SPECIAL_PROMPT;
            /* do this twice; 1st time gets the Quit? message again */
            tty_doprev_message();
            tty_doprev_message();
            ttyDisplay.intr++;
            fflush(stdout);
        }
    }
}

export function docorner(
    xmin, ymax,
    ystart_between_menu_pages) { /* void */
    let y;
    let cw = wins[WIN_MAP];
    let ystart = 0;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    /* #if 0: not in this build */

    if (ymax > LI())
        ymax = LI(); /* can happen if window gets smaller */

    if (ystart_between_menu_pages)
        ystart = ystart_between_menu_pages;

    for (y = ystart; y < ymax; y++) {
        tty_curs(BASE_WINDOW, xmin, y); /* move cursor */
        if (!ystart_between_menu_pages)
            cl_end();                   /* clear to end of line */

        if (y < cw.offy || y + clipy[0] > ROWNO)
            continue; /* only refresh board */

            row_refresh(xmin + clipx[0] - cw.offx, COLNO - 1,
                        y + clipy[0] - cw.offy);
    }

    end_glyphout();
    if (ymax >= (wins[WIN_STATUS].offy)
        && !ystart_between_menu_pages) {
        /* we have wrecked the bottom line */
        disp.botlx = TRUE;
        bot();
    }
}

export function end_glyphout() { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);

    if (GFlag) {
        GFlag = FALSE;
        graph_off();
    }

    if (ttyDisplay.color != NO_COLOR) {
        term_end_color();
        ttyDisplay.color = NO_COLOR;
    }
}

export function g_putch(in_ch) { /* void */
    let ch = char(in_ch);

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);

    if (SYMHANDLING(H_UTF8)) {
        putchar(ch);
    } else if (SYMHANDLING(H_IBM)
        /* for DECgraphics, lower-case letters with high bit set mean
           switch character set and render with high bit clear;
           user might want 8-bits for other characters */
        || (iflags.wc_eight_bit_input && (!SYMHANDLING(H_DEC)
                                     || (in_ch & 0x7f) < 0x60))) {
        /* IBM-compatible displays don't need other stuff */
        putchar(ch);
    } else if (ch & 0x80) {
        if (!GFlag || HE_resets_AS) {
            graph_on();
            GFlag = TRUE;
        }
        putchar((ch ^ 0x80)); /* Strip 8th bit */
    } else {
        if (GFlag

            ) {
            graph_off();
            GFlag = FALSE;
        }
        putchar(ch);
    }

    /* Strip high bit for DEC graphics, matching putchar(ch ^ 0x80) */
    nomux_putch(uchar(((ch & 0x80) ? (ch ^ 0x80) : ch)));

    return;
}

export function g_pututf8(utf8str) { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    while (uchars[utf8str]) {
        putchar(uchars[utf8str]);
        utf8str++;
    }
    return;
}

export function setclipped() { /* void */
    clipping[0] = TRUE;
    clipx[0] = clipy[0] = 0;
    clipxmax[0] = CO();
    clipymax[0] = LI() - 1 - iflags.wc2_statuslines;
}

export function tty_cliparound(x, y) { /* void */
    let oldx = clipx[0], oldy = clipy[0];

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (!clipping[0])
        return;
    if (x < clipx[0] + 5) {
        clipx[0] = max(0, x - 20);
        clipxmax[0] = clipx[0] + CO();
    } else if (x > clipxmax[0] - 5) {
        clipxmax[0] = min(COLNO, clipxmax[0] + 20);
        clipx[0] = clipxmax[0] - CO();
    }
    if (y < clipy[0] + 2) {
        clipy[0] = max(0, y - Math.trunc((clipymax[0] - clipy[0]) / 2));
        clipymax[0] = clipy[0] + (LI() - 1 - iflags.wc2_statuslines);
    } else if (y > clipymax[0] - 2) {
        clipymax[0] = min(ROWNO, clipymax[0] + Math.trunc((clipymax[0] - clipy[0]) / 2));
        clipy[0] = clipymax[0] - (LI() - 1 - iflags.wc2_statuslines);
    }
    if (clipx[0] != oldx || clipy[0] != oldy) {
        redraw_map(TRUE); /* ask the core to resend the map window's data */
    }
}

/*
 *  tty_print_glyph
 *
 *  Print the glyph to the output device.  Don't flush the output device.
 *
 *  Since this is only called from show_glyph(), it is assumed that the
 *  position and glyph are always correct (checked there)!
 */

export function tty_print_glyph(
    window,
    x, y,
    glyphinfo,
    bkglyphinfo) { /* void */
    let inverse_on = FALSE, colordone = FALSE, glyphdone = FALSE;
    let petattr = FALSE;
    let ch;
    let color;
    let special;

    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);

    if (clipping[0]) {
        if (x <= clipx[0] || y < clipy[0] || x >= clipxmax[0] || y >= clipymax[0])
            return;
    }

    /* get glyph ttychar, color, and special flags */
    ch = glyphinfo.ttychar;
    color = unsigned(glyphinfo.gm.sym.color);
    special = glyphinfo.gm.glyphflags;

     ;

    /* Move the cursor. */
    tty_curs(window, x, y);

      ;

    if (ul_hack() && ch == ord('_')) { /* non-destructive underscore */
        putchar(ord(' '));
        backsp();
    }

    if (iflags.wc_color) {
        ttyDisplay.colorflags = NH_BASIC_COLOR;
        if (color != ttyDisplay.color) {
            if (ttyDisplay.color != NO_COLOR)
                term_end_color();
        }
        /* we don't link with termcap.o if NO_TERMS is defined */
        if ((tty_procs.wincap2 & WC2_EXTRACOLORS)
            && glyphinfo.gm.customcolor != 0
            && iflags.colorcount >= 256
            && !calling_from_update_inventory[0]) {
            if ((glyphinfo.gm.customcolor & NH_BASIC_COLOR) == 0) {
                term_start_extracolor(glyphinfo.gm.customcolor,
                                      glyphinfo.gm.color256idx);
                ttyDisplay.colorflags = 0;
                colordone = TRUE;
            } else {
                color = COLORVAL(glyphinfo.gm.customcolor);
            }
        }
        if (!colordone) {
            ttyDisplay.color = color;
            if (color != NO_COLOR)
                term_start_color(int(color));
        }
    }   /* iflags.use_color aka iflags.wc_color */

    /* must be after color check; term_end_color may turn off inverse too;
       BW_LAVA, BW_ICE, BW_SINK, BW_ENGR won't ever be set when color is on;
       (tried bold for ice but it didn't look very good; inverse is easier
       to see although the Valkyrie quest ends up being hard on the eyes) */
    if (iflags.wc_color
        && bkglyphinfo && bkglyphinfo.framecolor != NO_COLOR) {
        ttyDisplay.framecolor = bkglyphinfo.framecolor;
        term_start_bgcolor(int(bkglyphinfo.framecolor));
    } else if ((special & MG_PET) != 0 && iflags.wc_hilite_pet) {
        term_start_attr(iflags.wc2_petattr);
        petattr = TRUE;
    } else if ((((special & MG_OBJPILE) != 0 && iflags.hilite_pile)
                || ((special & MG_FEMALE) != 0 && wizard() && iflags.wizmgender)
                || ((special & (MG_DETECT | MG_BW_LAVA | MG_BW_ICE
                                | MG_BW_SINK | MG_BW_ENGR)) != 0))
               && iflags.wc_inverse) {
        term_start_attr(ATR_INVERSE);
        inverse_on = TRUE;
    }

    if (!glyphdone
        && (tty_procs.wincap2 & WC2_U_UTF8STR) && SYMHANDLING(H_UTF8)
            && glyphinfo.gm.u && glyphinfo.gm.u.utf8str) {
        /* we have a sequence to do */
        g_pututf8(glyphinfo.gm.u.utf8str);
        glyphdone = TRUE;
    }

    if (!glyphdone)
        g_putch(ch); /* print the character */

    if (inverse_on)
        term_end_attr(ATR_INVERSE);
    else if (petattr)
        term_end_attr(iflags.wc2_petattr);
    if (iflags.wc_color) {
        /* turn off color as well, turning off ATR_INVERSE may have done
          this already and if so, we won't know the current state unless
          we do it explicitly */
        if (ttyDisplay.color != NO_COLOR
            || ttyDisplay.framecolor != NO_COLOR) {
            term_end_color();
            ttyDisplay.color = ttyDisplay.framecolor = NO_COLOR;
        }
        if (ttyDisplay.colorflags != NH_BASIC_COLOR)
            term_end_extracolor();
    }
    ;

    wins[window].curx++; /* one character over */
    ttyDisplay.curx++;   /* the real cursor moved too */
}

/* #ifdef NO_TERMS: not in this build */

export function tty_raw_print(str) { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (ttyDisplay)
        ttyDisplay.rawprint++;
    else if (chars[str])
        iflags.raw_printed++;
     ;

    puts(str);
    fflush(stdout);

    nomux_raw_emit(str, 0);
}

export function tty_raw_print_bold(str) { /* void */
    do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
    if (ttyDisplay)
        ttyDisplay.rawprint++;
    else if (chars[str])
        iflags.raw_printed++;
     ;
    term_start_raw_bold();

    fputs(str, stdout);

    term_end_raw_bold();

    puts(_(""));
    fflush(stdout);

    nomux_raw_emit(str, 1);
}

export function tty_nhgetch() { /* int */
    let i;

    /* kludge alert: Some Unix variants return funny values if getc() is
     * called, interrupted, and then called again.  There is non-reentrant
     * code in the internal _filbuf() routine, called by getc().
     */
    let nestbuf;

    do { if (program_state.done_hup) return (ord('\x1b')); } while (0);
    ;
    term_curs_set(1);
    fflush(stdout);

    nomux_capture_write_input_boundary();

    /* Note: if raw_print() and wait_synch() get called to report terminal
     * initialization problems, then wins[] and ttyDisplay might not be
     * available yet.  Such problems will probably be fatal before we get
     * here, but validate those pointers just in case...
     */
    if (WIN_MESSAGE != WIN_ERR && wins[WIN_MESSAGE])
        wins[WIN_MESSAGE].flags &= ~WIN_STOP;
    if (iflags.debug_fuzzer) {
        i = randomkey();
    } else {
        if (program_state.resize_pending)
            resize_tty();

        program_state.getting_char++;
        i = tgetch(); /* the session's input; there is no stdin */
        program_state.getting_char--;

        if (resize_mesg[0]) {
            resize_mesg[0] = 0;
            tty_clear_nhwindow(WIN_MESSAGE);
            i = ord('\x1b');
        }
    }
    term_curs_set(0);
    if (!i)
        i = ord('\x1b'); /* map NUL to ESC since nethack doesn't expect NUL */
    else if (i == EOF) {
        iflags.term_gone = 1;
        i = ord('\x1b'); /* same for EOF */
    }
    /* topline has been seen - we can clear the need for --More-- */
    if (ttyDisplay && ttyDisplay.toplin == TOPLINE_NEED_MORE)
        ttyDisplay.toplin = TOPLINE_NON_EMPTY;

    return i;
}

/*
 * return a key, or 0, in which case a mouse button was pressed
 * mouse events should be returned as character postitions in the map window.
 * Since normal tty's don't have mice, just return a key.
 */
/*ARGSUSED*/
export function tty_nh_poskey(x, y, mod) { /* int */
    let i;

    do { if (program_state.done_hup) return (ord('\x1b')); } while (0);
    /* #if defined(WIN32CON): not in this build */

    i = tty_nhgetch();

    return i;
}

export function win_tty_init(dir) { /* void */
    if (dir != WININIT)
        return;
    return;
}

export function tty_putmixed(window, attr, str) { /* void */
    const $frame = stack_frame(); try {
    let cw;
    let buf = stack_array(char, BUFSZ);

    let utf8flag = stack_var(int, 0);

    if (window == WIN_ERR || (cw = wins[window]) == null) {
        tty_raw_print(str);
        return;
    }
    ttyDisplay.mixed = 1;

    if ((windowprocs.wincap2 & WC2_U_UTF8STR) && SYMHANDLING(H_UTF8)) {
        mixed_to_utf8(buf, sizeof(array_of(char, BUFSZ)), str, utf8flag);
        if (cw.type == NHW_MESSAGE)
            ttyDisplay.topl_utf8 = utf8flag[0];
    } else

        decode_mixed(buf, str);
    /* now send it to the normal tty_putstr */
    tty_putstr(window, attr, buf);
    ttyDisplay.topl_utf8 = 0;
    ttyDisplay.mixed = 0;
    } finally { stack_pop($frame); }
}

/*
 * +------------------+
 * |  STATUS CODE     |
 * +------------------+
 */

/*
 * ----------------------------------------------------------------
 * tty_status_update
 *
 *      Called from the NetHack core and receives info hand-offs
 *      from the core, processes them, storing some information
 *      for rendering to the tty.
 *          -> make_things_fit()
 *          -> render_status()
 *
 * make_things_fit
 *
 *      Called from tty_status_update(). It calls check_fields()
 *      (described next) to get the required number of columns
 *      and tries a few different ways to squish a representation
 *      of the status window values onto the 80 column tty display.
 *          ->check_fields()
 *          ->set_condition_length()  - update the width of conditions
 *          ->shrink_enc()      - shrink encumbrance message word
 *          ->shrink_dlvl()     - reduce the width of Dlvl:42
 *
 *  check_fields
 *
 *      Verifies that all the fields are ready for display, and
 *      returns FALSE if called too early in the startup
 *      processing sequence. It also figures out where everything
 *      needs to go, taking the current shrinking attempts into
 *      account. It returns number of columns needed back to
 *      make_things_fit(), so make_things_fit() can make attempt
 *      to make adjustments.
 *
 *  render_status
 *
 *      Goes through each of the status row's fields and
 *      calls tty_putstatusfield() to place them on the display.
 *          ->tty_putstatusfield()
 *      At the end of the for-loop, the NOW values get copied
 *      to BEFORE values.
 *
 *  tty_putstatusfield()
 *
 *      Move the cursor to the target spot, and output the field
 *      asked for by render_status().
 *
 * ----------------------------------------------------------------
 */

/*
 * The following data structures come from the genl_ routines in
 * src/windows.c and as such are considered to be on the window-port
 * "side" of things, rather than the NetHack-core "side" of things.
 */

const tty_colormasks = static_var("tty_colormasks", ptr_to(ulong));
const tty_condition_bits = static_var("tty_condition_bits", long);
const tty_status = static_array("tty_status", array_of(struct_tty_status_fields, MAXBLSTATS), 2); /* 2: NOW,BEFORE */
const hpbar_percent = static_var("hpbar_percent", int); const hpbar_crit_hp = static_var("hpbar_crit_hp", int);

const encvals = static_array("encvals", array_of(ptr_to(char), 6), 3, [
    [ _(""), _("Burdened"), _("Stressed"), _("Strained"), _("Overtaxed"), _("Overloaded") ],
    [ _(""), _("Burden"),   _("Stress"),   _("Strain"),   _("Overtax"),   _("Overload")   ],
    [ _(""), _("Brd"),      _("Strs"),     _("Strn"),     _("Ovtx"),      _("Ovld")       ]
]);
export const blPAD = BL_FLUSH;
export const MAX_PER_ROW = 19;
/* 2 or 3 status lines */

const twolineorder = static_array("twolineorder", array_of(int, MAX_PER_ROW), 3, [
    [ BL_TITLE, BL_STR, BL_DX, BL_CO, BL_IN, BL_WI, BL_CH, BL_ALIGN,
      BL_SCORE, BL_FLUSH,
      blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD ],
    [ BL_LEVELDESC, BL_GOLD, BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX,
      BL_AC, BL_XP, BL_EXP, BL_HD, BL_TIME, BL_HUNGER, BL_CAP,
      BL_CONDITION, BL_WEAPON, BL_ARMOR, BL_TERRAIN, BL_VERS, BL_FLUSH ],
    /* third row of array isn't used for twolineorder */
    [ BL_FLUSH, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD,
      blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD ]
]);

const threelineorder = static_array("threelineorder", array_of(int, MAX_PER_ROW), 3, [
    [ BL_TITLE, BL_STR, BL_DX, BL_CO, BL_IN, BL_WI, BL_CH, BL_SCORE, BL_FLUSH,
      blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD ],
    [ BL_ALIGN, BL_GOLD, BL_HP, BL_HPMAX, BL_ENE, BL_ENEMAX,
      BL_AC, BL_XP, BL_EXP, BL_HD, BL_HUNGER, BL_CAP,
      BL_FLUSH, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD ],
    [ BL_LEVELDESC, BL_TIME, BL_CONDITION, BL_WEAPON, BL_ARMOR, BL_TERRAIN,
      BL_VERS, BL_FLUSH, blPAD,
      blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD, blPAD ]
]);
const fieldorder = static_var("fieldorder", ptr_to(array_of(int, MAX_PER_ROW)));

const finalx = static_array("finalx", array_of(int, 2), 3);    /* [rows][NOW or BEFORE] */
const windowdata_init = static_var("windowdata_init", schar, FALSE);
const cond_shrinklvl = static_var("cond_shrinklvl", int, 0);
const enclev = static_var("enclev", int, 0); const enc_shrinklvl = static_var("enc_shrinklvl", int, 0);
const dlvl_shrinklvl = static_var("dlvl_shrinklvl", int, 0);
const truncation_expected = static_var("truncation_expected", schar, FALSE);
export const FORCE_RESET = TRUE;
export const NO_RESET = FALSE;

/* This controls whether to skip fields that aren't
 * flagged as requiring updating during the current
 * render_status().
 *
 * Hopefully that can be confirmed as working correctly
 * for all platforms eventually and the conditional
 * setting below can be removed.
 */
const do_field_opt = static_var("do_field_opt", int, 1);

/*
 *  tty_status_init()
 *      -- initialize the tty-specific data structures.
 *      -- call genl_status_init() to initialize the general data.
 */
export function tty_status_init() { /* void */
    let i, num_rows;

    num_rows = StatusRows(); /* 2 or 3 */
    fieldorder[0] = (num_rows != 3) ? twolineorder : threelineorder;

    for (i = 0; i < MAXBLSTATS; ++i) {
        tty_status[NOW][i].idx = BL_FLUSH;
        tty_status[NOW][i].color = NO_COLOR; /* no color */
        tty_status[NOW][i].attr = ATR_NONE;
        tty_status[NOW][i].x = tty_status[NOW][i].y = 0;
        tty_status[NOW][i].valid  = FALSE;
        tty_status[NOW][i].dirty  = FALSE;
        tty_status[NOW][i].redraw = FALSE;
        tty_status[NOW][i].sanitycheck = FALSE;
        struct_assign(tty_status[BEFORE][i], tty_status[NOW][i]);
    }
    tty_condition_bits[0] = 0;
    hpbar_percent[0] = hpbar_crit_hp[0] = 0;

    /* let genl_status_init do most of the initialization */
    genl_status_init();
}

export function tty_status_enablefield(
    fieldidx,
    nm,
    fmt,
    enable) { /* void */
    genl_status_enablefield(fieldidx, nm, fmt, enable);
}

/*
 *  *_status_update()
 *      -- update the value of a status field.
 *      -- the fldindex identifies which field is changing and
 *         is an integer index value from botl.h
 *      -- fldindex could be any one of the following from botl.h:
 *         BL_TITLE, BL_STR, BL_DX, BL_CO, BL_IN, BL_WI, BL_CH,
 *         BL_ALIGN, BL_SCORE, BL_CAP, BL_GOLD, BL_ENE, BL_ENEMAX,
 *         BL_XP, BL_AC, BL_HD, BL_TIME, BL_HUNGER, BL_HP, BL_HPMAX,
 *         BL_LEVELDESC, BL_EXP, BL_CONDITION,
 *         BL_WEAPON, BL_ARMOR, BL_TERRAIN, BL_VERS
 *      -- fldindex could also be BL_FLUSH (-1), which is not really
 *         a field index, but is a special trigger to tell the
 *         windowport that it should output all changes received
 *         to this point. It marks the end of a bot() cycle.
 *      -- fldindex could also be BL_RESET (-3), which is not really
 *         a field index, but is a special advisory to tell the
 *         windowport that it should redisplay all its status fields,
 *         even if no changes have been presented to it.
 *      -- ptr is usually a "char *", unless fldindex is BL_CONDITION.
 *         If fldindex is BL_CONDITION, then ptr is a long value with
 *         any or none of the following bits set (from botl.h):
 *               BL_MASK_BAREH        0x00000001L
 *               BL_MASK_BLIND        0x00000002L
 *               BL_MASK_BUSY         0x00000004L
 *               BL_MASK_CONF         0x00000008L
 *               BL_MASK_DEAF         0x00000010L
 *               BL_MASK_ELF_IRON     0x00000020L
 *               BL_MASK_FLY          0x00000040L
 *               BL_MASK_FOODPOIS     0x00000080L
 *               BL_MASK_GLOWHANDS    0x00000100L
 *               BL_MASK_GRAB         0x00000200L
 *               BL_MASK_HALLU        0x00000400L
 *               BL_MASK_HELD         0x00000800L
 *               BL_MASK_ICY          0x00001000L
 *               BL_MASK_INLAVA       0x00002000L
 *               BL_MASK_LEV          0x00004000L
 *               BL_MASK_PARLYZ       0x00008000L
 *               BL_MASK_RIDE         0x00010000L
 *               BL_MASK_SLEEPING     0x00020000L
 *               BL_MASK_SLIME        0x00040000L
 *               BL_MASK_SLIPPERY     0x00080000L
 *               BL_MASK_STONE        0x00100000L
 *               BL_MASK_STRNGL       0x00200000L
 *               BL_MASK_STUN         0x00400000L
 *               BL_MASK_SUBMERGED    0x00800000L
 *               BL_MASK_TERMILL      0x01000000L
 *               BL_MASK_TETHERED     0x02000000L
 *               BL_MASK_TRAPPED      0x04000000L
 *               BL_MASK_UNCONSC      0x08000000L
 *               BL_MASK_WOUNDEDL     0x10000000L
 *               BL_MASK_HOLDING      0x20000000L
 *
 *      -- The value passed for BL_GOLD usually includes an encoded leading
 *         symbol for GOLD "\GXXXXNNNN:nnn". If the window port needs to use
 *         the textual gold amount without the leading "$:" the port will
 *         have to skip past ':' in the passed "ptr" for the BL_GOLD case.
 *      -- color is an unsigned int.
 *               color_index = color & 0x00FF;         CLR_* value
 *               attribute   = (color >> 8) & 0x00FF;  HL_ATTCLR_* mask
 *         This holds the color and attribute that the field should
 *         be displayed in.
 *         This is relevant for everything except BL_CONDITION fldindex.
 *         If fldindex is BL_CONDITION, this parameter should be ignored,
 *         as condition highlighting is done via the next colormasks
 *         parameter instead.
 *
 *      -- colormasks - pointer to cond_hilites[] array of colormasks.
 *         Only relevant for BL_CONDITION fldindex. The window port
 *         should ignore this parameter for other fldindex values.
 *         Each condition bit must only ever appear in one of the
 *         CLR_ array members, but can appear in multiple HL_ATTCLR_
 *         offsets (because more than one attribute can co-exist).
 *         See doc/window.txt for more details.
 */

export function tty_status_update(
    fldidx,
    ptr,
    chg,
    percent,
    color,
    colormasks) { /* void */
    const $frame = stack_frame(); try {
    let attrmask;
    let condptr = ref_to(long, ptr);
    let text = ptr;
    let goldbuf = stack_array(char, 40), lastchar, p;
    let fmt;
    let reset_state = NO_RESET;

    if ((fldidx < BL_RESET) || (fldidx >= MAXBLSTATS))
        return;

    if ((fldidx >= 0 && fldidx < MAXBLSTATS) && !chars[status_activefields + fldidx])
        return;

    switch (fldidx) {
    case BL_RESET:
        reset_state = FORCE_RESET;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case BL_FLUSH:
        if (make_things_fit(reset_state) || truncation_expected[0]) {
            render_status();
        }
        return;
    case BL_CONDITION:
        tty_status[NOW][fldidx].idx = fldidx;
        tty_condition_bits[0] = condptr[0];
        tty_colormasks[0] = colormasks;
        tty_status[NOW][fldidx].valid = TRUE;
        tty_status[NOW][fldidx].dirty = TRUE;
        tty_status[NOW][fldidx].sanitycheck = TRUE;
        truncation_expected[0] = FALSE;
        break;
    case BL_GOLD:
        text = decode_mixed(goldbuf, text);
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        attrmask = (color >> 8) & 0x00FF;
        fmt = status_fieldfmt[fldidx];
        if (!fmt)
            fmt = _("%s");
        /* should be checking for first enabled field here rather than
           just first field, but 'fieldorder' doesn't start any rows
           with fields which can be disabled so [any_row][0] suffices */
        if (chars[fmt] == ord(' ') && (fldidx == fieldorder[0][0][0]
                            || fldidx == fieldorder[0][1][0]
                            || fldidx == fieldorder[0][2][0]))
            ++fmt; /* skip leading space for first field on line */
        sprintf(status_vals[fldidx], fmt, text);
        tty_status[NOW][fldidx].idx = fldidx;
        tty_status[NOW][fldidx].color = (color & 0x00FF);
        tty_status[NOW][fldidx].attr = term_attr_fixup(attrmask);
        tty_status[NOW][fldidx].lth = strlen(status_vals[fldidx]);
        tty_status[NOW][fldidx].valid = TRUE;
        tty_status[NOW][fldidx].dirty = TRUE;
        tty_status[NOW][fldidx].sanitycheck = TRUE;
        break;
    }

    /* The core botl engine sends a single blank to the window port
       for carrying-capacity when it's unused. Let's suppress that */
    if (fldidx >= 0 && fldidx < MAXBLSTATS
        && tty_status[NOW][fldidx].lth == 1
        && chars[status_vals[fldidx] + 0] == ord(' ')) {
        chars[status_vals[fldidx] + 0] = ord('\0');
        tty_status[NOW][fldidx].lth = 0;
    }

    /* default processing above was required before these */
    switch (fldidx) {
    case BL_HP:
        if (iflags.wc2_hitpointbar) {
            /* Special additional processing for hitpointbar */
            hpbar_percent[0] = percent;
            hpbar_crit_hp[0] = critically_low_hp(TRUE) ? 1 : 0;
            tty_status[NOW][BL_TITLE].color = (color & 0x00FF);
            attrmask = HL_INVERSE | (hpbar_crit_hp[0] ? HL_BLINK : 0);
            tty_status[NOW][BL_TITLE].attr = term_attr_fixup(attrmask);
            tty_status[NOW][BL_TITLE].dirty = TRUE;
        }
        break;
    case BL_LEVELDESC:
        dlvl_shrinklvl[0] = 0; /* caller is passing full length string */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case BL_HUNGER:
        /* The core sends trailing blanks for some fields.
           Let's suppress the trailing blanks */
        if (tty_status[NOW][fldidx].lth > 0) {
            p = status_vals[fldidx];
            for (lastchar = eos(p); lastchar > p && chars[--lastchar] == ord(' '); ) {
                chars[lastchar] = ord('\0');
                tty_status[NOW][fldidx].lth--;
            }
        }
        break;
    case BL_TITLE:
        /* when hitpointbar is enabled, rendering will enforce a length
           of 30 on title, padding with spaces or truncating if necessary */
        if (iflags.wc2_hitpointbar)
            tty_status[NOW][fldidx].lth = 30 + 2; /* '[' and ']' */
        break;
    case BL_GOLD:
        /* \GXXXXNNNN counts as 1 [moot since we use decode_mixed() above] */
        if ((p = strchr(status_vals[fldidx], ord('\\'))) != 0 && chars[p + 1] == ord('G'))
            tty_status[NOW][fldidx].lth -= (10 - 1);
        break;
    case BL_CAP:
        enc_shrinklvl[0] = 0; /* caller is passing full length string */
        enclev[0] = stat_cap_indx();
        break;
    }
    /* As of 3.6.2 we only render on BL_FLUSH (or BL_RESET) */
    return;
    } finally { stack_pop($frame); }
}

function make_things_fit(force_update) { /* int */
    const $frame = stack_frame(); try {
    let trycnt, fitting = 0, requirement;
    let rowsz = stack_array(int, MAX_STATUS_ROWS), num_rows, condrow, otheroptions = 0;

    num_rows = StatusRows();
    condrow = num_rows - 1; /* always last row, 1 for 0..1 or 2 for 0..2 */
    cond_shrinklvl[0] = 0;
    if (enc_shrinklvl[0] > 0 && num_rows == 2)
        shrink_enc(0);
    if (dlvl_shrinklvl[0] > 0)
        shrink_dlvl(0);
    set_condition_length();
    for (trycnt = 0; trycnt < 6 && !fitting; ++trycnt) {
        /* FIXME: this remeasures each line every time even though it
           is only attempting to shrink one of them and the other one
           (or two) remains the same */
        if (!check_fields(force_update, rowsz)) {
            fitting = 0;
            break;
        }

        requirement = rowsz[condrow] - 1;
        if (requirement <= wins[WIN_STATUS].cols - 1) {
            fitting = requirement;
            break;  /* we're good */
        }
        if (trycnt < 2) {
            if (cond_shrinklvl[0] < trycnt + 1) {
                cond_shrinklvl[0] = trycnt + 1;
                set_condition_length();
            }
            continue;
        }
        if (cond_shrinklvl[0] >= 2) {
            /* We've exhausted the condition identifiers shrinkage,
             * so let's try shrinking other things...
             */
            if (otheroptions < 2) {
                /* try shrinking the encumbrance word, but
                   only when it's on the same line as conditions */
                if (num_rows == 2)
                    shrink_enc(otheroptions + 1);
            } else if (otheroptions == 2) {
                shrink_dlvl(1);
            } else {
                /* Last resort - turn on trunction */
                truncation_expected[0] = TRUE;
                break;
            }
            ++otheroptions;
        }
    }
    return fitting;
    } finally { stack_pop($frame); }
}

/*
 * This is the routine where we figure out where each field
 * should be placed, and flag whether the on-screen details
 * must be updated because they need to change.
 * This is now done at an individual field case-by-case level.
 */
function check_fields(forcefields, sz) { /* boolean */
    let c, i, row, col, num_rows, idx;
    let valid = TRUE, matchprev, update_right;

    if (!windowdata_init[0] && !check_windowdata())
        return FALSE;

    num_rows = StatusRows(); /* 2 or 3 */
    for (row = 0; row < num_rows; ++row) {
        sz[row] = 0;
        col = 1;
        update_right = FALSE;
        for (i = 0; (idx = fieldorder[0][row][i]) != BL_FLUSH; ++i) {
            if (!chars[status_activefields + idx])
                continue;
            if (!tty_status[NOW][idx].valid)
                valid = FALSE;
            /* might be called more than once for shrink tests, so need
               to reset these (redraw and x at any rate) each time */
            tty_status[NOW][idx].redraw = FALSE;
            tty_status[NOW][idx].y = row;
            tty_status[NOW][idx].x = col;

            /* On a change to the field location, everything further
               to the right must be updated as well.  (Not necessarily
               everything; it's possible for complementary changes across
               multiple fields to put stuff further right back in sync.) */
            if (unsigned(unsigned(tty_status[NOW][idx].x) + tty_status[NOW][idx].lth)
                != unsigned(unsigned(tty_status[BEFORE][idx].x) + tty_status[BEFORE][idx].lth))
                update_right = TRUE;
            else if (tty_status[NOW][idx].lth != tty_status[BEFORE][idx].lth
                     || tty_status[NOW][idx].x != tty_status[BEFORE][idx].x)
                tty_status[NOW][idx].redraw = TRUE;
            else /* in case update_right is set, we're back in sync now */
                update_right = FALSE;

            matchprev = FALSE; /* assume failure */
            if (valid && !update_right && !forcefields
                && !tty_status[NOW][idx].redraw) {
                /*
                 * Check values against those already on the display.
                 *  - Is the additional processing time for this worth it?
                 */
                if (do_field_opt[0]
                    /* color/attr checks aren't right for 'condition'
                       and neither is examining status_vals[BL_CONDITION]
                       so skip same-contents optimization for conditions */
                    && idx != BL_CONDITION
                    && (tty_status[NOW][idx].color
                        == tty_status[BEFORE][idx].color)
                    && (tty_status[NOW][idx].attr
                        == tty_status[BEFORE][idx].attr)) {
                    matchprev = TRUE; /* assume success */
                    if (tty_status[NOW][idx].dirty) {
                        /* compare values */
                        let ob, nb; /* old byte, new byte */
                        let cw = wins[WIN_STATUS];

                        c = col - 1;
                        ob = cw.data[row] + c;
                        nb = status_vals[idx];
                        while (chars[nb] && c < cw.cols) {
                            if (chars[nb] != chars[ob])
                                break;
                            nb++;
                            ob++;
                            c++;
                        }
                        /* if we're not at the end of new string, no match;
                           we don't need to worry about whether there might
                           be leftover old string; that could only happen
                           if they have different lengths, in which case
                           'update_right' will be set and we won't get here */
                        if (chars[nb])
                            matchprev = FALSE;
                    }
                }
            }

            if (forcefields || update_right
                || (tty_status[NOW][idx].dirty && !matchprev))
                tty_status[NOW][idx].redraw = TRUE;

            col = int(col + (tty_status[NOW][idx].lth));
        }
        sz[row] = col;
    }
    return valid;
}

/* #if (NH_DEVEL_STATUS != NH_STATUS_RELEASED): not in this build */

/*
 * This is what places a field on the tty display.
 */
function tty_putstatusfield(text, x, y) { /* void */
    let i, n, ncols, nrows, lth = 0;
    let cw = null;

    if (WIN_STATUS == WIN_ERR
        || (cw = wins[WIN_STATUS]) == null)
        panic(_("tty_putstatusfield: Invalid WinDesc\n"));

    ncols = cw.cols;
    nrows = cw.maxrow;
    lth = int(strlen(text));

     ;

    if (x < ncols && y < nrows) {
        if (x != cw.curx || y != cw.cury)
            tty_curs(NHW_STATUS, x, y);
        for (i = 0; i < lth; ++i) {
            n = i + x;
            if (n < ncols && chars[text]) {
                putchar(chars[text]);

                nomux_putch(chars[text]);

                ttyDisplay.curx++;
                cw.curx++;
                chars[cw.data[y] + (n - 1)] = chars[text];
                text++;
            }
        }
    }
}

/* caller must set cond_shrinklvl (0..2) before calling us */
function set_condition_length() { /* void */
    let mask;
    let c, lth = 0;

    if (tty_condition_bits[0]) {
        for (c = 0; c < SIZE(conditions); ++c) {
            mask = conditions[c].mask;
            if (and64(tty_condition_bits[0], mask) == mask)
                lth += 1 + int(strlen(conditions[c].text[cond_shrinklvl[0]]));
        }
    }
    tty_status[NOW][BL_CONDITION].lth = unsigned(lth);
}

function shrink_enc(lvl) { /* void */
    /* shrink or restore the encumbrance word */
    if (lvl <= 2) {
        enc_shrinklvl[0] = lvl;
        sprintf(status_vals[BL_CAP], _(" %s"), encvals[lvl][enclev[0]]);
    }
    tty_status[NOW][BL_CAP].lth = strlen(status_vals[BL_CAP]);
}

function shrink_dlvl(lvl) { /* void */
    const $frame = stack_frame(); try {
    /* try changing Dlvl: to Dl: */
    let buf = stack_array(char, BUFSZ);
    let levval = strchr(status_vals[BL_LEVELDESC], ord(':'));

    if (levval) {
        dlvl_shrinklvl[0] = lvl;
        strcpy(buf, (lvl == 0) ? _("Dlvl") : _("Dl"));
        strcat(buf, levval);
        strcpy(status_vals[BL_LEVELDESC], buf);
        tty_status[NOW][BL_LEVELDESC].lth = strlen(status_vals[BL_LEVELDESC]);
    }
    } finally { stack_pop($frame); }
}

/*
 * Ensure the underlying status window data start out
 * blank and null-terminated.
 */
function check_windowdata() { /* boolean */
    if (WIN_STATUS == WIN_ERR || wins[WIN_STATUS] == null) {
        paniclog(_("check_windowdata"), _(" null status window."));
        return FALSE;
    } else if (!windowdata_init[0]) {
        tty_clear_nhwindow(WIN_STATUS); /* also sets cw->data[] to spaces */
        windowdata_init[0] = TRUE;
    }
    return TRUE;
}

/*
 * Return what color this condition should
 * be displayed in based on user settings.
 */
function condcolor(bm, bmarray) { /* int */
    let i;

    if (bm && bmarray)
        for (i = 0; i < CLR_MAX; ++i) {
            if ((bm & bmarray[i]) != 0)
                return i;
        }
    return NO_COLOR;
}

function condattr(bm, bmarray) { /* int */
    let attr = 0;
    let i;

    if (bm && bmarray) {
        for (i = HL_ATTCLR_BOLD; i < BL_ATTCLR_MAX; ++i) {
            if ((bm & bmarray[i]) != 0) {
                switch (i) {
                case HL_ATTCLR_BOLD:
                    attr |= HL_BOLD;
                    break;
                case HL_ATTCLR_DIM:
                    attr |= HL_DIM;
                    break;
                case HL_ATTCLR_ITALIC:
                    attr |= HL_ITALIC;
                    break;
                case HL_ATTCLR_ULINE:
                    attr |= HL_ULINE;
                    break;
                case HL_ATTCLR_BLINK:
                    attr |= HL_BLINK;
                    break;
                case HL_ATTCLR_INVERSE:
                    attr |= HL_INVERSE;
                    break;
                }
            }
        }
    }
    return attr;
}

export function Begin_Attr(m) { do {
        if (m) {
            if (m & HL_BOLD)
                term_start_attr(ATR_BOLD);
            if (m & HL_DIM)
                term_start_attr(ATR_DIM);
            if (m & HL_ITALIC)
                term_start_attr(ATR_ITALIC);
            if (m & HL_ULINE)
                term_start_attr(ATR_ULINE);
            if (m & HL_BLINK)
                term_start_attr(ATR_BLINK);
            if (m & HL_INVERSE)
                term_start_attr(ATR_INVERSE);
        }
    } while (0) }

export function End_Attr(m) { do {
        if (m) {
            if (m & HL_INVERSE)
                term_end_attr(ATR_INVERSE);
            if (m & HL_BLINK)
                term_end_attr(ATR_BLINK);
            if (m & HL_ULINE)
                term_end_attr(ATR_ULINE);
            if (m & HL_ITALIC)
                term_end_attr(ATR_ITALIC);
            if (m & HL_DIM)
                term_end_attr(ATR_DIM);
            if (m & HL_BOLD)
                term_end_attr(ATR_BOLD);
        }
    } while (0) }

function render_status() { /* void */
    const $frame = stack_frame(); try {
    let mask, bits;
    let i, x, y, idx, c, ci, row, tlth, num_rows,
        coloridx = 0, attrmask = 0;
    let text;
    let cw = null;

    if (WIN_STATUS == WIN_ERR
        || (cw = wins[WIN_STATUS]) == null) {
        paniclog(_("render_status"), _("WIN_ERR on status window."));
        return;
    }

    num_rows = StatusRows(); /* 2 or 3 */
    for (row = 0; row < num_rows; ++row) {
        do { if (program_state.done_hup) { morc = ord("\x1b"); return; } } while (0);
        y = row;
        tty_curs(WIN_STATUS, 1, y);
        for (i = 0; (idx = fieldorder[0][row][i]) != BL_FLUSH; ++i) {
            if (!chars[status_activefields + idx])
                continue;
            x = tty_status[NOW][idx].x;
            text = status_vals[idx]; /* always "" for BL_CONDITION */
            tlth = int((tty_status[NOW][idx].lth)); /* valid for BL_CONDITION */

            if (tty_status[NOW][idx].redraw || !do_field_opt[0]) {
                let hitpointbar = (idx == BL_TITLE
                                       && iflags.wc2_hitpointbar ? 1 : 0);

                if (idx == BL_CONDITION) {
                    /*
                     * +-----------------+
                     * | Condition Codes |
                     * +-----------------+
                     */
                    bits = tty_condition_bits[0];
                    /*
                     * If no bits are set, we can fall through condition
                     * rendering code to finalx[] handling (and subsequent
                     * rest-of-line erasure if line is shorter than before).
                     *
                     * First, when conditions are on 3rd row, they might
                     * be indented to line up with a position on 2nd row.
                     */
                    if (row == MAX_STATUS_ROWS - 1 && bits != 0) {
                        let cstart, last_col = cw.cols;
                        let dat = cw.data[y] + 0;

                        /* 'version' might follow conditions; if so, adjust
                           expectations for where conditions should end;
                           only matters when conditions are being indented */
                        if (chars[status_activefields + BL_VERS]
                            && fieldorder[0][row][i + 1] == BL_VERS)
                            last_col -= int((tty_status[NOW][BL_VERS].lth));
                        /* line up with hunger (or where it would have
                           been when currently omitted); if there isn't
                           enough room for that, right justify; or place
                           as-is if not even enough room for /that/; we
                           expect hunger to be on preceding row, in which
                           case its current data has been moved to [BEFORE] */
                        if (tty_status[BEFORE][BL_HUNGER].y < row
                            && x < tty_status[BEFORE][BL_HUNGER].x
                            && (tty_status[BEFORE][BL_HUNGER].x + tlth
                                < last_col - 1))
                            cstart = tty_status[BEFORE][BL_HUNGER].x;
                        else if (x + tlth < cw.cols - 1)
                            cstart = last_col - tlth;
                        else
                            cstart = x;
                        /* indent conditions to line them up with 2nd row */
                        if (x < cstart) {
                            do {
                                if (chars[dat + (x - 1)] != ord(' '))
                                    tty_putstatusfield(_(" "), x, y);
                            } while (++x < cstart);
                            tty_status[NOW][BL_CONDITION].x = x;
                            tty_curs(WIN_STATUS, x, y);
                        }
                    }
                    /* actually draw condition words */
                    for (c = 0; c < SIZE(conditions) && bits != 0; ++c) {
                        ci = cond_idx[c];
                        mask = conditions[ci].mask;
                        if (bits & mask) {
                            let condtext;

                            tty_putstatusfield(_(" "), x++, y);
                            if (iflags.hilite_delta) {
                                attrmask = condattr(mask, tty_colormasks[0]);
                                Begin_Attr(attrmask);
                                coloridx = condcolor(mask, tty_colormasks[0]);
                                if (coloridx != NO_COLOR)
                                    term_start_color(coloridx);
                            }
                            condtext = conditions[ci].text[cond_shrinklvl[0]];
                            if (x >= cw.cols && !truncation_expected[0]) {
                                impossible(
                         _("Unexpected condition placement overflow for \"%s\""),
                                           condtext);
                                condtext = _("");
                                bits = 0; /* skip any remaining conditions */
                            }
                            tty_putstatusfield(condtext, x, y);
                            x += int(strlen(condtext));
                            if (iflags.hilite_delta) {
                                if (coloridx != NO_COLOR)
                                    term_end_color();
                                End_Attr(attrmask);
                            }
                            bits = and64(bits, not64(mask));
                        }
                    }
                    /* 'x' is 1-based and 'cols' and 'data' are 0-based,
                       so x==cols means we just stored in data[N-2] and
                       are now positioned at data[N-1], the terminator;
                       that's ok as long as we don't write there */
                    if (x > cw.cols) {
                        let once_only = static_var("render_status.once_only", unsigned, 0);

                        if (!truncation_expected[0] && !once_only[0]++)
                            paniclog(_("render_status()"),
                                     _(" unexpected truncation."));
                        x = cw.cols;
                    }
                } else if (hitpointbar) {
                    /*
                     * +-------------------------+
                     * | Title with Hitpoint Bar |
                     * +-------------------------+
                     */
                    /* hitpointbar using hp percent calculation */
                    let bar_len, bar_pos = 0;
                    let bar = stack_array(char, 30 + 1), bar2 = 0, savedch = ord('\0');
                    let twoparts = +(hpbar_percent[0] < 100);

                    /* force exactly 30 characters, padded with spaces
                       if shorter or truncated if longer */
                    if (strlen(text) != 30) {
                        sprintf(bar, _("%-30.30s"), text);
                        strcpy(status_vals[BL_TITLE], bar);
                    } else {
                        strcpy(bar, text);
                    }
                    if (hpbar_crit_hp[0])
                        repad_with_dashes(bar);
                    bar_len = int(strlen(bar)); /* always 30 */
                    /*tlth = bar_len + 2; // not needed within this 'if'*/
                    attrmask = 0; /* for the second part only case: dead */
                    /* when at full HP, the whole title will be highlighted;
                       when injured or dead, there will be a second portion
                       which is not highlighted */
                    if (twoparts) {
                        /* figure out where to separate the two parts */
                        bar_pos = Math.trunc((bar_len * hpbar_percent[0]) / 100);
                        if (bar_pos < 1 && hpbar_percent[0] > 0)
                            bar_pos = 1;
                        if (bar_pos >= bar_len && hpbar_percent[0] < 100)
                            bar_pos = bar_len - 1;
                        bar2 = bar + bar_pos;
                        savedch = chars[bar2];
                        chars[bar2] = ord('\0');
                    }
                    tty_putstatusfield(_("["), x++, y);
                    if (chars[bar]) { /* always True, unless twoparts+dead (0 HP) */
                        coloridx = tty_status[NOW][BL_TITLE].color;
                        attrmask = tty_status[NOW][BL_TITLE].attr;
                        Begin_Attr(attrmask);
                        if (iflags.hilite_delta && coloridx != NO_COLOR)
                            term_start_color(coloridx);
                        tty_putstatusfield(bar, x, y);
                        x += int(strlen(bar));
                        if (iflags.hilite_delta && coloridx != NO_COLOR)
                            term_end_color();
                        End_Attr(attrmask);
                    }
                    if (twoparts) {
                        if ((attrmask & HL_BLINK) != 0)
                            term_start_attr(ATR_BLINK);
                        chars[bar2] = savedch;
                        tty_putstatusfield(bar2, x, y);
                        x += int(strlen(bar2));
                        if ((attrmask & HL_BLINK) != 0)
                            term_end_attr(ATR_BLINK);
                    }
                    tty_putstatusfield(_("]"), x++, y);
                } else {
                    /*
                     * +-----------------------------+
                     * | Everything else that is not |
                     * |   in a special case above   |
                     * +-----------------------------+
                     */
                    if (idx == BL_VERS
                        /* if 'version' is the last field in its row, right
                           justify it (otherwise just treat it as ordinary) */
                        && fieldorder[0][row][i + 1] == BL_FLUSH) {
                        let vstart;
                        let dat = cw.data[y] + 0;
                        /* FIXME:  there's something fishy going on here;
                           'x' ends up out of synch when conditions have
                           3rd row indentation and the indenting of version
                           overwrites them with spaces; this hides that */
                        let vx = int(unsigned(unsigned(tty_status[BEFORE][BL_CONDITION].x)
                                 + tty_status[BEFORE][BL_CONDITION].lth));

                        if (i > 0 && fieldorder[0][row][i - 1] == BL_CONDITION
                            && x != vx) {
                            x = vx;
                            tty_curs(WIN_STATUS, x, y);
                        }
                        /* indent version to right justify it */
                        vstart = cw.cols - int((tty_status[NOW][idx].lth));
                        if (x < vstart) {
                            do {
                                if (chars[dat + (x - 1)] != ord(' '))
                                    tty_putstatusfield(_(" "), x, y);
                            } while (++x < vstart);
                            tty_status[NOW][BL_VERS].x = x;
                        }
                    }
                    if (iflags.hilite_delta) {
                        while (chars[text] == ord(' ')) {
                            tty_putstatusfield(_(" "), x++, y);
                            text++;
                        }
                        if (chars[text] == ord('/') && idx == BL_EXP) {
                            tty_putstatusfield(_("/"), x++, y);
                            text++;
                        }
                        attrmask = tty_status[NOW][idx].attr;
                        Begin_Attr(attrmask);
                        coloridx = tty_status[NOW][idx].color;
                        if (coloridx != NO_COLOR)
                            term_start_color(coloridx);
                    }
                    tty_putstatusfield(text, x, y);
                    x += int(strlen(text));
                    if (iflags.hilite_delta) {
                        if (coloridx != NO_COLOR)
                            term_end_color();
                        End_Attr(attrmask);
                    }
                }
            } else {
                /* not rendered => same text as before */
                x += tlth;
            }
            finalx[row][NOW] = x - 1;
            /* reset .redraw and .dirty now that field has been rendered */
            tty_status[NOW][idx].dirty  = FALSE;
            tty_status[NOW][idx].redraw = FALSE;
            tty_status[NOW][idx].sanitycheck = FALSE;
            /*
             * For comparison of current and previous:
             * - Copy the entire tty_status struct.
             */
            struct_assign(tty_status[BEFORE][idx], tty_status[NOW][idx]);
        } /* for i=..., idx=fieldorder[][i] */
        x = finalx[row][NOW];
        if ((x < finalx[row][BEFORE] || !finalx[row][BEFORE])
            && x + 1 < cw.cols) {
            tty_curs(WIN_STATUS, x + 1, y);
            cl_end();
        }
        /*
         * For comparison of current and previous:
         * - Copy the last written column number on the row.
         */
        finalx[row][BEFORE] = finalx[row][NOW];
    } /* for row=... */
    return;
    } finally { stack_pop($frame); }
}

/*wintty.c*/

import {
    BEFORE, BL_AC, BL_ALIGN, BL_ARMOR, BL_ATTCLR_MAX, BL_CAP, BL_CH, BL_CO, BL_CONDITION, BL_DX,
    BL_ENE, BL_ENEMAX, BL_EXP, BL_FLUSH, BL_GOLD, BL_HD, BL_HP, BL_HPMAX, BL_HUNGER, BL_IN,
    BL_LEVELDESC, BL_RESET, BL_SCORE, BL_STR, BL_TERRAIN, BL_TIME, BL_TITLE, BL_VERS, BL_WEAPON,
    BL_WI, BL_XP, HL_ATTCLR_BLINK, HL_ATTCLR_BOLD, HL_ATTCLR_DIM, HL_ATTCLR_INVERSE,
    HL_ATTCLR_ITALIC, HL_ATTCLR_ULINE, HL_BLINK, HL_BOLD, HL_DIM, HL_INVERSE, HL_ITALIC, HL_ULINE,
    MAXBLSTATS, NOW,
} from "../../src/botl.h.js";
import { CLR_MAX, NH_BASIC_COLOR, NO_COLOR, struct_color_and_attr } from "../../src/color.h.js";
import { COLORVAL } from "../../src/color.h.macros.js";
import { CO, LI } from "../../src/decl.h.macros.js";
import { GOLD_SYM } from "../../src/defsym.h.js";
import {
    MG_BW_ENGR, MG_BW_ICE, MG_BW_LAVA, MG_BW_SINK, MG_DETECT, MG_FEMALE, MG_OBJPILE, MG_PET,
    NO_GLYPH, docrtRefresh,
} from "../../src/display.h.js";
import { dlb_fclose, dlb_fgets, dlb_fopen } from "../../src/dlb.h.macros.js";
import { wizard } from "../../src/flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, MAX_MSG_HISTORY, QBUFSZ, ROWNO, TRUE, set_in_game,
} from "../../src/global.h.js";
import { max, min } from "../../src/hack.h.macros.js";
import { AppendLongDigit } from "../../src/integer.h.macros.js";
import { debugpline4 } from "../../src/lint.h.macros.js";
import { H_DEC, H_IBM, H_UTF8 } from "../../src/sym.h.js";
import { SYMHANDLING } from "../../src/sym.h.macros.js";
import { nh_CD, nh_CM, nh_ND, ul_hack } from "../../src/tcap.h.macros.js";
import { tgetch } from "../../src/unixconf.h.macros.js";
import {
    WC2_DARKGRAY, WC2_EXTRACOLORS, WC2_EXTRASTATUS, WC2_FLUSH_STATUS, WC2_HILITE_STATUS,
    WC2_HITPOINTBAR, WC2_PETATTR, WC2_RESET_STATUS, WC2_SELECTSAVED, WC2_STATUSLINES,
    WC2_SUPPRESS_HIST, WC2_URGENT_MESG, WC2_U_UTF8STR, WC_COLOR, WC_EIGHT_BIT_IN, WC_HILITE_PET,
    WC_INVERSE, WININIT, struct_window_procs, wp_tty,
} from "../../src/winprocs.h.js";
import {
    MAXWIN, NHW_BASE, TOPLINE_EMPTY, TOPLINE_NEED_MORE, TOPLINE_NON_EMPTY, TOPLINE_SPECIAL_PROMPT,
    WIN_CANCELLED, WIN_NOSTOP, WIN_STOP, struct_DisplayDesc, struct_WinDesc, struct_tty_mi,
    struct_tty_status_fields,
} from "../../src/wintty.h.js";
import {
    ATR_BLINK, ATR_BOLD, ATR_DIM, ATR_INVERSE, ATR_ITALIC, ATR_NOHISTORY, ATR_NONE, ATR_ULINE,
    ATR_URGENT, MENU_BEHAVE_PERMINV, MENU_FIRST_PAGE, MENU_INVERT_ALL, MENU_INVERT_PAGE,
    MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, MENU_LAST_PAGE, MENU_NEXT_PAGE,
    MENU_PREVIOUS_PAGE, MENU_SEARCH, MENU_SELECT_ALL, MENU_SELECT_PAGE, MENU_UNSELECT_ALL,
    MENU_UNSELECT_PAGE, NHW_MAP, NHW_MENU, NHW_MESSAGE, NHW_PERMINVENT, NHW_STATUS, NHW_TEXT,
    PICK_ANY, PICK_NONE, PICK_ONE, WIN_ERR, request_settings, set_menu_promptstyle, set_mode,
    struct_any, struct_mi,
} from "../../src/wintype.h.js";
import { SIZE } from "../../rt/cmacros.js";
import {
    char, int, long, ord, schar, short, sizeof, sizeof_string, uchar, ulong, unsigned,
} from "../../rt/ctypes.js";
import { global_scalar } from "../../rt/globals.js";
import { chars, stack_frame, stack_pop, uchars } from "../../rt/heap.js";
import { and64, not64 } from "../../rt/int64.js";
import {
    BUFSIZ, EOF, EXIT_SUCCESS, SIGWINCH, fflush, fputs, free, perror, putchar, puts, setbuf, signal,
    sprintf, stdout, strcat, strchr, strcmp, strcpy, strlen, strncpy,
} from "../../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_to, sizeof_member, struct_assign, view_of,
} from "../../rt/struct.js";
import { alloc, dupstr } from "../../src/alloc.js";
import {
    bot, cond_idx, conditions, repad_with_dashes, stat_cap_indx, status_initialize,
} from "../../src/botl.js";
import { randomkey } from "../../src/cmd.js";
import {
    cg, disp, flags, gg, gm, gt, iflags, program_state, quitchars, svp, u,
} from "../../src/decl.js";
import {
    docrt, docrt_flags, flush_screen, nul_glyphinfo, redraw_map, row_refresh,
} from "../../src/display.js";
import { nh_terminate, panic } from "../../src/end.js";
import { clearlocks, paniclog } from "../../src/files.js";
import { eos, tabexpand } from "../../src/hacklib.js";
import { free_pickinv_cache } from "../../src/invent.js";
import { map_menu_cmd, set_wc2_option_mod_status } from "../../src/options.js";
import { impossible, nhassert_failed, pline } from "../../src/pline.js";
import { critically_low_hp } from "../../src/pray.js";
import { restore_menu } from "../../src/restore.js";
import { genl_outrip } from "../../src/rip.js";
import { genl_player_setup } from "../../src/role.js";
import { pmatchi } from "../../src/strutil.js";
import { mixed_to_utf8 } from "../../src/utf8map.js";
import { copyright_banner_line } from "../../src/version.js";
import {
    decode_mixed, genl_can_suspend_yes, genl_preference_update, genl_status_enablefield,
    genl_status_finish, genl_status_init, menuitem_invert_test, status_activefields,
    status_fieldfmt, status_vals, windowprocs,
} from "../../src/windows.js";
import { gettty, getwindowsz, setftty, settty } from "../../sys/c2js/nhjs_tty_api.js";
import { tty_get_ext_cmd, tty_getlin, xwaitforspace } from "./getline.js";
import {
    backsp, cl_end, cl_eos, cmov, graph_off, graph_on, home, nocmov,
    nomux_capture_write_input_boundary, nomux_clear_screen, nomux_putch, nomux_raw_emit,
    standoutbeg, standoutend, term_attr_fixup, term_clear_screen, term_curs_set, term_end_attr,
    term_end_color, term_end_extracolor, term_end_raw_bold, term_shutdown, term_start_attr,
    term_start_bgcolor, term_start_color, term_start_extracolor, term_start_raw_bold, term_startup,
    tty_delay_output, tty_nhbell, tty_number_pad, xputs,
} from "./termcap.js";
import {
    addtopl, more, remember_topl, show_topl, tty_doprev_message, tty_getmsghistory,
    tty_putmsghistory, tty_yn_function, update_topl,
} from "./topl.js";
const __FILE__ = "../win/tty/wintty.c";
