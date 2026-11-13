/* NetHack 5.0	topl.c	$NHDT-Date: 1717967339 2024/06/09 21:08:59 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.89 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2009. */
/* NetHack may be freely redistributed.  See license for details. */

export function tty_doprev_message() { /* int */
    let cw = wins[WIN_MESSAGE];
    let prevmsg_win;
    let i;

    if ((iflags.prevmsg_window != ord('s'))
        && !ttyDisplay.inread) {           /* not single */
        if (iflags.prevmsg_window == ord('f')) { /* full */
            prevmsg_win = create_nhwindow()(NHW_MENU);
            putstr()(prevmsg_win, 0, _("Message History"));
            putstr()(prevmsg_win, 0, _(""));
            cw.maxcol = cw.maxrow;
            i = cw.maxcol;
            do {
                if (cw.data[i] && strcmp(cw.data[i], _("")))
                    putstr()(prevmsg_win, 0, cw.data[i]);
                i = (i + 1) % cw.rows;
            } while (i != cw.maxcol);
            putstr()(prevmsg_win, 0, gt.toplines);
            display_nhwindow()(prevmsg_win, TRUE);
            destroy_nhwindow()(prevmsg_win);
        } else if (iflags.prevmsg_window == ord('c')) { /* combination */
            do {
                morc = 0;
                if (cw.maxcol == cw.maxrow) {
                    ttyDisplay.dismiss_more = C(ord('p')); /* ^P ok at --More-- */
                    redotoplin(gt.toplines);
                    cw.maxcol--;
                    if (cw.maxcol < 0)
                        cw.maxcol = cw.rows - 1;
                    if (!cw.data[cw.maxcol])
                        cw.maxcol = cw.maxrow;
                } else if (cw.maxcol == (cw.maxrow - 1)) {
                    ttyDisplay.dismiss_more = C(ord('p')); /* ^P ok at --More-- */
                    redotoplin(cw.data[cw.maxcol]);
                    cw.maxcol--;
                    if (cw.maxcol < 0)
                        cw.maxcol = cw.rows - 1;
                    if (!cw.data[cw.maxcol])
                        cw.maxcol = cw.maxrow;
                } else {
                    prevmsg_win = create_nhwindow()(NHW_MENU);
                    putstr()(prevmsg_win, 0, _("Message History"));
                    putstr()(prevmsg_win, 0, _(""));
                    cw.maxcol = cw.maxrow;
                    i = cw.maxcol;
                    do {
                        if (cw.data[i] && strcmp(cw.data[i], _("")))
                            putstr()(prevmsg_win, 0, cw.data[i]);
                        i = (i + 1) % cw.rows;
                    } while (i != cw.maxcol);
                    putstr()(prevmsg_win, 0, gt.toplines);
                    display_nhwindow()(prevmsg_win, TRUE);
                    destroy_nhwindow()(prevmsg_win);
                }
            } while (morc == C(ord('p')));
            ttyDisplay.dismiss_more = 0;
        } else { /* reversed */
            morc = 0;
            prevmsg_win = create_nhwindow()(NHW_MENU);
            putstr()(prevmsg_win, 0, _("Message History"));
            putstr()(prevmsg_win, 0, _(""));
            putstr()(prevmsg_win, 0, gt.toplines);
            cw.maxcol = cw.maxrow - 1;
            if (cw.maxcol < 0)
                cw.maxcol = cw.rows - 1;
            do {
                putstr()(prevmsg_win, 0, cw.data[cw.maxcol]);
                cw.maxcol--;
                if (cw.maxcol < 0)
                    cw.maxcol = cw.rows - 1;
                if (!cw.data[cw.maxcol])
                    cw.maxcol = cw.maxrow;
            } while (cw.maxcol != cw.maxrow);

            display_nhwindow()(prevmsg_win, TRUE);
            destroy_nhwindow()(prevmsg_win);
            cw.maxcol = cw.maxrow;
            ttyDisplay.dismiss_more = 0;
        }
    } else if (iflags.prevmsg_window == ord('s')) { /* single */
        ttyDisplay.dismiss_more = C(ord('p')); /* <ctrl/P> allowed at --More-- */
        do {
            morc = 0;
            if (cw.maxcol == cw.maxrow)
                redotoplin(gt.toplines);
            else if (cw.data[cw.maxcol])
                redotoplin(cw.data[cw.maxcol]);
            cw.maxcol--;
            if (cw.maxcol < 0)
                cw.maxcol = cw.rows - 1;
            if (!cw.data[cw.maxcol])
                cw.maxcol = cw.maxrow;
        } while (morc == C(ord('p')));
        ttyDisplay.dismiss_more = 0;
    }
    return 0;
}

function redotoplin(str) { /* void */
    let otoplin = ttyDisplay.toplin;

    home();
    if (!ttyDisplay.topl_utf8) {
        if (ttyDisplay.mixed && (chars[str] & 0x80)) {
            /* kludge for the / command, the only time we ever want a */
            /* graphics character on the top line */
            g_putch((chars[str++]));
            ttyDisplay.curx++;
        }
        end_glyphout(); /* in case message printed during graphics output */
    }
    putsyms(str);
    cl_end();
    ttyDisplay.toplin = TOPLINE_NEED_MORE;
    if (ttyDisplay.cury && otoplin != TOPLINE_SPECIAL_PROMPT)
        more();
}

/* for use by tty_putstr() */
export function show_topl(str) { /* void */
    let cw = wins[WIN_MESSAGE];

    /* show if either STOP isn't set or current message specifies NOSTOP */
    if ((cw.flags & (WIN_STOP | WIN_NOSTOP)) != WIN_STOP) {
        /* NOSTOP cancels persistent STOP and is a one-shot operation;
           force both to be cleared (no-op for either bit that isn't set) */
        cw.flags &= ~(WIN_STOP | WIN_NOSTOP);

        if (ttyDisplay.cury && ttyDisplay.toplin == TOPLINE_NON_EMPTY)
            tty_clear_nhwindow(WIN_MESSAGE);

        cw.curx = cw.cury = 0;
        home();
        cl_end();
        addtopl(str);

        if (ttyDisplay.cury && ttyDisplay.toplin != TOPLINE_SPECIAL_PROMPT)
            ttyDisplay.toplin = TOPLINE_NON_EMPTY;
    }
}

/* used by update_topl(); also by tty_putstr() */
export function remember_topl() { /* void */
    let cw = wins[WIN_MESSAGE];
    let idx = cw.maxrow;
    let len = unsigned(strlen(gt.toplines) + 1);

    if ((cw.flags & WIN_LOCKHISTORY) || !chars[gt.toplines])
        return;

    if (len > unsigned((cw.datlen[idx]))) {
        if (cw.data[idx])
            free(cw.data[idx]);
        len = unsigned(len + (8 - (len & 7))); /* pad up to next multiple of 8 */
        cw.data[idx] = addr_of(alloc(len));
        cw.datlen[idx] = short(len);
    }
    strcpy(cw.data[idx], gt.toplines);
    if (!program_state.in_checkpoint) {
        chars[gt.toplines] = ord('\0');
        cw.maxcol = cw.maxrow = (idx + 1) % cw.rows;
    }
}

export function addtopl(s) { /* void */
    let cw = wins[WIN_MESSAGE];

    tty_curs(BASE_WINDOW, cw.curx + 1, cw.cury);
    putsyms(s);
    cl_end();
    ttyDisplay.toplin = TOPLINE_NEED_MORE;
}

export function more() { /* void */
    let cw = wins[WIN_MESSAGE];

    if (iflags.debug_fuzzer)
        return;

    /* avoid recursion -- only happens from interrupts */
    if (ttyDisplay.inmore)
        return;

    ttyDisplay.inmore++;

    if (ttyDisplay.toplin) {
        tty_curs(BASE_WINDOW, cw.curx + 1, cw.cury);
        if (cw.curx >= CO() - 8)
            topl_putsym(ord('\n'));
    }

    if (flags.standout)
        standoutbeg();
    putsyms(defmorestr);
    if (flags.standout)
        standoutend();

    xwaitforspace(_("\x1b "));

    if (morc == ord('\x1b')) {
        if (!(cw.flags & WIN_NOSTOP))
            cw.flags |= WIN_STOP;
    }

    if (ttyDisplay.toplin && cw.cury) {
        docorner(1, cw.cury + 1, 0);
        cw.curx = cw.cury = 0;
        home();
    } else if (morc == ord('\x1b')) {
        cw.curx = cw.cury = 0;
        home();
        cl_end();
    }
    ttyDisplay.toplin = TOPLINE_EMPTY;
    ttyDisplay.inmore = 0;
}

export function update_topl(bp) { /* void */
    let tl, otl;
    let n0;
    let notdied = 1;
    let cw = wins[WIN_MESSAGE];
    let skip = +((cw.flags & (WIN_STOP | WIN_NOSTOP)) == WIN_STOP);

    /* If there is room on the line, print message on same line */
    /* But messages like "You die..." deserve their own line */
    n0 = int(strlen(bp));
    if ((ttyDisplay.toplin == TOPLINE_NEED_MORE || skip)
        && cw.cury == 0
        && n0 + int(strlen(gt.toplines)) + 3 < CO() - 8 /* room for --More-- */
        && (notdied = strncmp(bp, _("You die"), 7)) != 0) {
        strcat(gt.toplines, _("  "));
        strcat(gt.toplines, bp);
        cw.curx += 2;
        if (!skip)
            addtopl(bp);
        return;
    } else if (!skip) {
        if (ttyDisplay.toplin == TOPLINE_NEED_MORE) {
            more();
        } else if (cw.cury) { /* for toplin==TOPLINE_NON_EMPTY && cury > 1 */
            docorner(1, cw.cury + 1, 0); /* reset cury = 0 if redraw screen */
            cw.curx = cw.cury = 0;   /* from home--cls() & docorner(1,n,0) */
        }
    }
    remember_topl();
    strncpy(gt.toplines, bp, TBUFSZ);
    chars[gt.toplines + (TBUFSZ - 1)] = 0;

    for (tl = gt.toplines; n0 >= CO(); ) {
        otl = tl;
        for (tl += CO() - 1; tl != otl; --tl)
            if (chars[tl] == ord(' '))
                break;
        if (tl == otl) {
            /* Eek!  A huge token.  Try splitting after it. */
            tl = strchr(otl, ord(' '));
            if (!tl)
                break; /* No choice but to spit it out whole. */
        }
        chars[tl++] = ord('\n');
        n0 = int(strlen(tl));
    }
    if (!notdied) /* double negative => "You die"; avoid suppressing mesg */
        cw.flags &= ~WIN_STOP, skip = FALSE;
    if (!skip)
        redotoplin(gt.toplines);
}

function topl_putsym(c) { /* void */
    let cw = wins[WIN_MESSAGE];

    if (cw == null)
        panic(_("Putsym window MESSAGE nonexistent"));

    switch (c) {
    case ord('\b'):
        if (ttyDisplay.curx == 0 && ttyDisplay.cury > 0)
            tty_curs(BASE_WINDOW, CO(), ttyDisplay.cury - 1);
        backsp();
        ((!!(ttyDisplay.curx > 0)) || (nhassert_failed(_("ttyDisplay->curx > 0"), _(__FILE__), 0), 0));
        ttyDisplay.curx--;
        cw.curx = ttyDisplay.curx;
        return;
    case ord('\n'):
        cl_end();
        ttyDisplay.curx = 0;
        ttyDisplay.cury++;
        cw.cury = ttyDisplay.cury;

        break;
    default:
        if (ttyDisplay.curx == CO() - 1)
            topl_putsym(ord('\n')); /* 1 <= curx < CO; avoid CO */

        ttyDisplay.curx++;
    }
    cw.curx = ttyDisplay.curx;
    if (cw.curx == 0)
        cl_end();

    putchar(c);

    /* On non-WIN32CON, curx is incremented BEFORE putchar (see line 336
       above), so curx is one ahead of where the character was actually
       written.  Temporarily decrement to write to the correct shadow
       buffer position — same pattern used by process_menu_window,
       process_text_window, and other NOMUX hooks in wintty.c. */
    { let svx = ttyDisplay.curx; ttyDisplay.curx--; nomux_putch(c); ttyDisplay.curx = svx; }
}

export function putsyms(str) { /* void */
    while (chars[str])
        topl_putsym(chars[str++]);
}

function removetopl(n) { /* void */
    /* assume addtopl() has been done, so ttyDisplay->toplin is already set */
    while (n-- > 0)
        putsyms(_("\b \b"));
}

 /* from xxxtty.c; don't need kill_char */

/* returns a single keystroke; also sets 'yn_number' */
export function tty_yn_function(
    query,
    resp,
    def) { /* char */
    const $frame = stack_frame(); try {
    /*
     * Generic yes/no function.  'def' is the default (returned by space
     * or return; 'esc' returns 'q', or 'n', or the default, depending on
     * what's in the expected-response string.  The 'query' string is
     * printed before the user is asked about the string.
     *
     * If resp is NULL, any single character is accepted and returned.
     * If not-NULL, only characters in it are allowed (exceptions:  the
     * quitchars are always allowed, and if it contains '#' then digits
     * are allowed).  If it includes an <esc>, anything beyond that won't
     * be shown in the prompt to the user but will be acceptable as input.
     */
    var q;
    var rtmp = stack_array(char, 40);
    var digit_ok, allow_num, preserve_case = FALSE;
    var cw = wins[WIN_MESSAGE];
    var doprev = 0;
    var prompt = stack_array(char, BUFSZ);

    yn_number = 0;
    if (ttyDisplay.toplin == TOPLINE_NEED_MORE
        && (cw.flags & (WIN_STOP | WIN_NOSTOP)) != WIN_STOP)
        more();
    cw.flags &= ~(WIN_STOP | WIN_NOSTOP);
    ttyDisplay.toplin = TOPLINE_SPECIAL_PROMPT;
    ttyDisplay.inread++;
    clean_up: { if (resp) {
        var rb, respbuf = stack_array(char, QBUFSZ);

        allow_num = +(strchr(resp, ord('#')) != 0);
        strcpy(respbuf, resp);
        /* normally we force lowercase, but if any uppercase letters
           are present in the allowed response, preserve case;
           check this before stripping the hidden choices */
        for (rb = respbuf; chars[rb]; ++rb)
            if (ord('A') <= chars[rb] && chars[rb] <= ord('Z')) {
                preserve_case = TRUE;
                break;
            }
        /* any acceptable responses that follow <esc> aren't displayed */
        if ((rb = strchr(respbuf, ord('\x1b'))) != 0)
            chars[rb] = ord('\0');
        strncpy(prompt, query, QBUFSZ - 1);
        chars[prompt + (QBUFSZ - 1)] = ord('\0');
        sprintf(eos(prompt), _(" [%s]"), respbuf);
        if (def)
            sprintf(eos(prompt), _(" (%c)"), def);
        /* not pline("%s ", prompt);
           trailing space is wanted here in case of reprompt */
        strcat(prompt, _(" "));
        custompline(OVERRIDE_MSGTYPE | SUPPRESS_HISTORY, _("%s"), prompt);
    } else {
        /* no restriction on allowed response, so always preserve case */
        /* preserve_case = TRUE; -- moot since we're jumping to the end */
        sprintf(prompt, _("%s "), query);
        custompline(OVERRIDE_MSGTYPE | SUPPRESS_HISTORY, _("%s"), prompt);
        q = readchar();
        break clean_up;
    }

    do { /* loop until we get valid input */
        q = readchar();
        if (!preserve_case)
            q = lowc(q);
        if (q == ord('\x10')) { /* ctrl-P */
            if (iflags.prevmsg_window != ord('s')) {
                var sav = ttyDisplay.inread;
                ttyDisplay.inread = 0;
                tty_doprev_message();
                ttyDisplay.inread = sav;
                tty_clear_nhwindow(WIN_MESSAGE);
                cw.maxcol = cw.maxrow;
                addtopl(prompt);
            } else {
                if (!doprev)
                    tty_doprev_message(); /* need two initially */
                tty_doprev_message();
                doprev = 1;
            }
            q = ord('\0'); /* force another loop iteration */
            continue;
        } else if (doprev) {
            /* BUG[?]: this probably ought to check whether the
               character which has just been read is an acceptable
               response; if so, skip the reprompt and use it. */
            tty_clear_nhwindow(WIN_MESSAGE);
            cw.maxcol = cw.maxrow;
            doprev = 0;
            addtopl(prompt);
            q = ord('\0'); /* force another loop iteration */
            continue;
        }
        digit_ok = (allow_num && digit(q) ? 1 : 0);
        if (q == ord('\x1b')) {
            if (strchr(resp, ord('q')))
                q = ord('q');
            else if (strchr(resp, ord('n')))
                q = ord('n');
            else
                q = def;
            break;
        } else if (strchr(quitchars, q)) {
            q = def;
            break;
        }
        if (!strchr(resp, q) && !digit_ok) {
            tty_nhbell();
            q = 0;
        } else if (q == ord('#') || digit_ok) {
            var z, digit_string = stack_array(char, 2);
            var n_len = 0;
            var value = 0;

            addtopl(_("#")), n_len++;
            chars[digit_string + 1] = ord('\0');
            if (q != ord('#')) {
                chars[digit_string + 0] = q;
                addtopl(digit_string), n_len++;
                value = q - ord('0');
                q = ord('#');
            }
            do { /* loop until we get a non-digit */
                z = readchar();
                if (!preserve_case)
                    z = lowc(z);
                if (digit(z)) {
                    var dgt = (z - ord('0'));

                    /* value = (10 * value) + (z - '0'); */
                    value = AppendLongDigit(value, dgt);
                    if (value < 0)
                        break; /* overflow: try again */
                    chars[digit_string + 0] = z;
                    addtopl(digit_string), n_len++;
                } else if (z == ord('y') || strchr(quitchars, z)) {
                    if (z == ord('\x1b'))
                        value = -1; /* abort */
                    z = ord('\n');       /* break */
                } else if (z == erase_char || z == ord('\b')) {
                    if (n_len <= 1) {
                        value = -1;
                        break;
                    } else {
                        value = Math.trunc(value / 10);
                        removetopl(1), n_len--;
                    }
                } else {
                    value = -1; /* abort */
                    tty_nhbell();
                    break;
                }
            } while (z != ord('\n'));
            if (value > 0)
                yn_number = value;
            else if (value == 0)
                q = ord('n'); /* 0 => "no" */
            else {       /* remove number from top line, then try again */
                removetopl(n_len), n_len = 0;
                q = ord('\0');
            }
        }
    } while (!q);
 }
    if (yn_number)
        sprintf(rtmp, _("#%lld"), yn_number);
    else
        key2txt(uchar(q), rtmp);
    /* addtopl(rtmp); -- rewrite gt.toplines instead */
    sprintf(gt.toplines, _("%s%s"), prompt, rtmp);

    ttyDisplay.inread--;
    ttyDisplay.toplin = TOPLINE_NON_EMPTY;
    if (ttyDisplay.intr)
        ttyDisplay.intr--;
    if (wins[WIN_MESSAGE].cury)
        tty_clear_nhwindow(WIN_MESSAGE);

    return q;
    } finally { stack_pop($frame); }
}

/* shared by tty_getmsghistory() and tty_putmsghistory() */
const snapshot_mesgs = static_var("snapshot_mesgs", ptr_to(ptr_to(char)), null);

/* collect currently available message history data into a sequential array;
   optionally, purge that data from the active circular buffer set as we go */
function msghistory_snapshot(
    purge) { /* void */ /* clear message history buffer as we copy it */
    let mesg;
    let i, inidx, outidx;
    let cw;

    /* paranoia (too early or too late panic save attempt?) */
    if (WIN_MESSAGE == WIN_ERR || !wins[WIN_MESSAGE])
        return;
    cw = wins[WIN_MESSAGE];

    /* flush gt.toplines[], moving most recent message to history */
    remember_topl();

    /* for a passive snapshot, we just copy pointers, so can't allow further
       history updating to take place because that could clobber them */
    if (!purge)
        cw.flags |= WIN_LOCKHISTORY;

    snapshot_mesgs[0] = ref_to(ptr_to(char), addr_of(alloc(unsigned((cw.rows + 1) * sizeof(ptr_to(char))))));
    outidx = 0;
    inidx = cw.maxrow;
    for (i = 0; i < cw.rows; ++i) {
        snapshot_mesgs[0][i] = 0;
        mesg = cw.data[inidx];
        if (mesg && chars[mesg]) {
            snapshot_mesgs[0][outidx++] = mesg;
            if (purge) {
                /* we're taking this pointer away; subsequent history
                   updates will eventually allocate a new one to replace it */
                cw.data[inidx] = 0;
                cw.datlen[inidx] = 0;
            }
        }
        inidx = (inidx + 1) % cw.rows;
    }
    snapshot_mesgs[0][cw.rows] = 0; /* sentinel */

    /* for a destructive snapshot, history is now completely empty */
    if (purge)
        cw.maxcol = cw.maxrow = 0;
}

/* release memory allocated to message history snapshot */
function free_msghistory_snapshot(
    purged) { /* void */ /* True: took history's pointers, * False: just cloned them */
    if (snapshot_mesgs[0]) {
        /* snapshot pointers are no longer in use */
        if (purged) {
            let i;

            for (i = 0; snapshot_mesgs[0][i]; ++i)
                free((snapshot_mesgs[0][i]));
        }

        free(addr_of(snapshot_mesgs[0])), snapshot_mesgs[0] = null;

        /* history can resume being updated at will now... */
        if (!purged)
            wins[WIN_MESSAGE].flags &= ~WIN_LOCKHISTORY;
    }
}

/*
 * This is called by the core save routines.
 * Each time we are called, we return one string from the
 * message history starting with the oldest message first.
 * When none are left, we return a final null string.
 *
 * History is collected at the time of the first call.
 * Any new messages issued after that point will not be
 * included among the output of the subsequent calls.
 */
export function tty_getmsghistory(init) { /* char * */
    let nxtidx = static_var("tty_getmsghistory.nxtidx", int);
    let nextmesg;
    let result = 0;

    if (init) {
        msghistory_snapshot(FALSE);
        nxtidx[0] = 0;
    }

    if (snapshot_mesgs[0]) {
        nextmesg = snapshot_mesgs[0][nxtidx[0]++];
        if (nextmesg) {
            result = nextmesg;
        } else {
            free_msghistory_snapshot(FALSE);
        }
    }
    return result;
}

/*
 * This is called by the core savefile restore routines.
 * Each time we are called, we stuff the string into our message
 * history recall buffer. The core will send the oldest message
 * first (actually it sends them in the order they exist in the
 * save file, but that is supposed to be the oldest first).
 * These messages get pushed behind any which have been issued
 * since this session with the program has been started, since
 * they come from a previous session and logically precede
 * anything (like "Restoring save file...") that's happened now.
 *
 * Called with a null pointer to finish up restoration.
 *
 * It's also called by the quest pager code when a block message
 * has a one-line summary specified.  We put that line directly
 * into message history for ^P recall without having displayed it.
 */
export function tty_putmsghistory(msg, restoring_msghist) { /* void */
    let initd = static_var("tty_putmsghistory.initd", schar, FALSE);
    let idx;

    if (restoring_msghist && !initd[0]) {
        /* we're restoring history from the previous session, but new
           messages have already been issued this session ("Restoring...",
           for instance); collect current history (ie, those new messages),
           and also clear it out so that nothing will be present when the
           restored ones are being put into place */
        msghistory_snapshot(TRUE);
        initd[0] = TRUE;
    }

    if (msg) {
        /* Caller is asking us to remember a top line that needed more.
           Should we call more?  This can happen when the player has set
           iflags.force_invmenu and they attempt to shoot with nothing in
           the quiver. */
        if (ttyDisplay && ttyDisplay.toplin == TOPLINE_NEED_MORE)
            ttyDisplay.toplin = TOPLINE_NON_EMPTY;

        /* move most recent message to history, make this become most recent */
        remember_topl();
        strcpy(gt.toplines, msg);
    } else if (snapshot_mesgs[0]) {
        ((!!(ttyDisplay == null ||
                 ttyDisplay.toplin != TOPLINE_NEED_MORE)) || (nhassert_failed(_("ttyDisplay == NULL || ttyDisplay->toplin != TOPLINE_NEED_MORE"), _(__FILE__), 0), 0));

        /* done putting arbitrary messages in; put the snapshot ones back */
        for (idx = 0; snapshot_mesgs[0][idx]; ++idx) {
            remember_topl();
            strcpy(gt.toplines, snapshot_mesgs[0][idx]);
        }
        /* now release the snapshot */
        free_msghistory_snapshot(TRUE);
        initd[0] = FALSE; /* reset */
    }
}

/*topl.c*/

import { CO } from "../../src/decl.h.macros.js";
import { BUFSZ, FALSE, QBUFSZ, TBUFSZ, TRUE } from "../../src/global.h.js";
import { C } from "../../src/global.h.macros.js";
import { OVERRIDE_MSGTYPE, SUPPRESS_HISTORY } from "../../src/hack.h.js";
import { AppendLongDigit } from "../../src/integer.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, putstr,
} from "../../src/winprocs.h.macros.js";
import {
    TOPLINE_EMPTY, TOPLINE_NEED_MORE, TOPLINE_NON_EMPTY, TOPLINE_SPECIAL_PROMPT, WIN_LOCKHISTORY,
    WIN_NOSTOP, WIN_STOP,
} from "../../src/wintty.h.js";
import { NHW_MENU, WIN_ERR } from "../../src/wintype.h.js";
import { char, int, ord, schar, short, sizeof, uchar, unsigned } from "../../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../../rt/heap.js";
import {
    free, putchar, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncmp, strncpy,
} from "../../rt/libc.js";
import { stack_array, static_var } from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { addr_of, ptr_to, ref_to } from "../../rt/struct.js";
import { alloc } from "../../src/alloc.js";
import { key2txt, readchar } from "../../src/cmd.js";
import { flags, gt, iflags, program_state, quitchars } from "../../src/decl.js";
import { panic } from "../../src/end.js";
import { digit, eos, lowc } from "../../src/hacklib.js";
import { custompline, nhassert_failed } from "../../src/pline.js";
import { xwaitforspace } from "./getline.js";
import {
    backsp, cl_end, home, nomux_putch, standoutbeg, standoutend, tty_nhbell,
} from "./termcap.js";
import {
    defmorestr, docorner, end_glyphout, g_putch, tty_clear_nhwindow, tty_curs, wins,
} from "./wintty.js";
const __FILE__ = "../win/tty/topl.c";
