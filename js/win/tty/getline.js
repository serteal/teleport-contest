/* NetHack 5.0	getline.c	$NHDT-Date: 1701285885 2023/11/29 19:24:45 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.59 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

global_scalar("morc", char, 0); /* tell the outside world what char you chose */
const suppress_history = static_var("suppress_history", schar);

 /* cmd.c */

 /* from appropriate tty.c file */

/*
 * Read a line closed with '\n' into the array char bufp[BUFSZ].
 * (The '\n' is not stored. The string is closed with a '\0'.)
 * Reading can be interrupted by an escape ('\033').  If there is already
 * some text, it is removed and prompting continues as if from the start.
 * However, if there is no text yet (or anymore) then "\033" is returned.
 */
export function tty_getlin(query, bufp) { /* void */
    suppress_history[0] = FALSE;
    hooked_tty_getlin(query, bufp, null);
}

function hooked_tty_getlin(
    query,
    bufp,
    hook) { /* void */
    let obufp = bufp;
    let c;
    let cw = wins[WIN_MESSAGE];
    let doprev = FALSE;

    if (ttyDisplay.toplin == TOPLINE_NEED_MORE && !(cw.flags & WIN_STOP))
        more();
    cw.flags &= ~WIN_STOP;
    ttyDisplay.toplin = TOPLINE_SPECIAL_PROMPT;
    ttyDisplay.inread++;

    /*
     * Issue the prompt.
     *
     * custompline() will call vpline() which calls flush_screen() which
     * calls bot(). The core now disables bot() processing while inside
     * getlin, so the screen won't be modified during whatever this prompt
     * is for.
     */
    custompline(OVERRIDE_MSGTYPE | SUPPRESS_HISTORY, _("%s "), query);

    /* !EDIT_GETLIN: bufp is output only; init it to empty */
    chars[bufp] = ord('\0');

    for (;;) {
        fflush(stdout);
        strcat(strcat(strcpy(gt.toplines, query), _(" ")), obufp);
        term_curs_set(1);
        c = pgetchar();
        term_curs_set(0);
        if (c == ord('\x1b') || c == EOF) {
            if (c == EOF)
                iflags.term_gone = 1;
            if (c == ord('\x1b') && chars[obufp + 0] != ord('\0')) {
                chars[obufp + 0] = ord('\0');
                bufp = obufp;
                tty_clear_nhwindow(WIN_MESSAGE);
                cw.maxcol = cw.maxrow;
                addtopl(query);
                addtopl(_(" "));
                addtopl(obufp);
            } else {
                chars[obufp + 0] = ord('\x1b');
                chars[obufp + 1] = ord('\0');
                break;
            }
        }
        if (ttyDisplay.intr) {
            ttyDisplay.intr--;
            chars[bufp] = 0;
        }
        if (c == C(ord('p'))) { /* ctrl-P, doesn't honor rebinding #prevmsg cmd */
            let sav = ttyDisplay.inread;

            ttyDisplay.inread = 0;
            if (iflags.prevmsg_window == ord('s')
                || (iflags.prevmsg_window == ord('c') && !doprev)) {
                /* msg_window:single, or msg_window:combination while it's
                   behaving like msg_window:single */
                if (!doprev)
                    tty_doprev_message(); /* need two initially */
                tty_doprev_message();
                ttyDisplay.inread = sav;
                doprev = TRUE;
                continue;
            } else {
                /* msg_window:full or reverse, or msg_window:combination while
                   it's behaving like msg_window:full */
                tty_doprev_message();
                ttyDisplay.inread = sav;
                doprev = FALSE;
                tty_clear_nhwindow(WIN_MESSAGE);
                cw.maxcol = cw.maxrow;
                addtopl(query);
                addtopl(_(" "));
                chars[bufp] = 0;
                addtopl(obufp);
            }
        } else if (doprev) {
            tty_clear_nhwindow(WIN_MESSAGE);
            cw.maxcol = cw.maxrow;
            doprev = FALSE;
            addtopl(query);
            addtopl(_(" "));
            chars[bufp] = 0;
            addtopl(obufp);
        }
        if (c == erase_char || c == ord('\b')) {
            if (bufp != obufp) {
                let i;

                bufp--;

                putsyms(_("\b"));
                for (i = bufp; chars[i]; ++i)
                    putsyms(_(" "));
                for (; i > bufp; --i)
                    putsyms(_("\b"));
                chars[bufp] = 0;
            } else
                tty_nhbell();
        } else if (c == ord('\n') || c == ord('\r')) {
            break;
        } else if (ord(' ') <= uchar(c) && c != ord('\x7f')
                   /* avoid isprint() - some people don't have it
                      ' ' is not always a printing char */
                   && (bufp - obufp < BUFSZ - 1 && bufp - obufp < COLNO)) {
            let i = eos(bufp);

            chars[bufp] = c;
            chars[bufp + 1] = 0;
            putsyms(bufp);
            bufp++;
            if (hook && hook(obufp)) {
                putsyms(bufp);

                /* pointer and cursor left where they were */
                for (i = bufp; chars[i]; ++i)
                    putsyms(_("\b"));
            } else if (i > bufp) {
                let s = i;

                /* erase rest of prior guess */
                for (; i > bufp; --i)
                    putsyms(_(" "));
                for (; s > bufp; --s)
                    putsyms(_("\b"));
            }
        } else if (c == kill_char || c == ord('\x7f')) { /* Robert Viduya */
            /* this test last - @ might be the kill_char */

            for (; chars[bufp]; ++bufp)
                putsyms(_(" "));
            for (; bufp != obufp; --bufp)
                putsyms(_("\b \b"));
            chars[bufp] = 0;
        } else
            tty_nhbell();
    }
    ttyDisplay.toplin = TOPLINE_NON_EMPTY;
    ttyDisplay.inread--;
    clear_nhwindow()(WIN_MESSAGE); /* clean up after ourselves */

    if (suppress_history[0]) {
        /* prevent next message from pushing current query+answer into
           tty message history */
        chars[gt.toplines] = ord('\0');
    }
}

export function xwaitforspace(s) { /* void */ /* chars allowed besides return */
    let c, x = ttyDisplay ? ttyDisplay.dismiss_more : ord('\n');

    morc = 0;
    while (

        !program_state.done_hup &&

        (c = tty_nhgetch()) != EOF) {
        if (c == ord('\n') || c == ord('\r'))
            break;

        if (iflags.cbreak) {
            if (c == ord('\x1b')) {
                if (ttyDisplay)
                    ttyDisplay.dismiss_more = 1;
                morc = ord('\x1b');
                break;
            }
            if ((s && strchr(s, c)) || c == x || (x == ord('\n') && c == ord('\r'))) {
                morc = char(c);
                break;
            }
            tty_nhbell();
        }
    }
}

/*
 * Implement extended command completion by using this hook into
 * tty_getlin.  Check the characters already typed, if they uniquely
 * identify an extended command, expand the string to the whole
 * command.
 *
 * Return TRUE if we've extended the string at base.  Otherwise return FALSE.
 * Assumptions:
 *
 *      + we don't change the characters that are already in base
 *      + base has enough room to hold our string
 */
function ext_cmd_getlin_hook(base) { /* boolean */
    const $frame = stack_frame(); try {
    let ecmatches = stack_var(ptr_to(int));
    let nmatches = extcmds_match(base, ECM_NOFLAGS, ecmatches);

    if (nmatches == 1) {
        let ec = extcmds_getentry(ecmatches[0][0]);

        strcpy(base, ec.ef_txt);
        return TRUE;
    }

    return FALSE; /* didn't match anything */
    } finally { stack_pop($frame); }
}

/*
 * Read in an extended command, doing command line completion.  We
 * stop when we have found enough characters to make a unique command.
 */
export function tty_get_ext_cmd() { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let nmatches;
    let ecmatches = stack_var(ptr_to(int), null);
    let no_hook = null;
    let extcmd_char = stack_array(char, 2);

    if (iflags.extmenu)
        return extcmd_via_menu();

    suppress_history[0] = TRUE;
    /* maybe a runtime option?
     * hooked_tty_getlin("#", buf,
     *                   (flags.cmd_comp && !gi.in_doagain)
     *                      ? ext_cmd_getlin_hook
     *                      : (getlin_hook_proc) 0);
     */
    chars[extcmd_char + 0] = extcmd_initiator(), chars[extcmd_char + 1] = ord('\0');
    chars[buf + 0] = ord('\0');
    hooked_tty_getlin(extcmd_char, buf,
                      !gi.in_doagain ? ext_cmd_getlin_hook : no_hook);
    mungspaces(buf);

    nmatches = (chars[buf + 0] == ord('\0') || chars[buf + 0] == ord('\x1b')) ? -1
              : extcmds_match(buf, ECM_IGNOREAC | ECM_EXACTMATCH, ecmatches);
    if (nmatches != 1) {
        if (nmatches != -1)
            pline(_("%s%.60s: unknown extended command."),
                  visctrl(chars[extcmd_char + 0]), buf);
        return -1;
    }

    return ecmatches[0][0];
    } finally { stack_pop($frame); }
}

/*getline.c*/

import { ECM_EXACTMATCH, ECM_IGNOREAC, ECM_NOFLAGS } from "../../src/func_tab.h.js";
import { BUFSZ, COLNO, FALSE, TRUE } from "../../src/global.h.js";
import { C } from "../../src/global.h.macros.js";
import { OVERRIDE_MSGTYPE, SUPPRESS_HISTORY } from "../../src/hack.h.js";
import { clear_nhwindow } from "../../src/winprocs.h.macros.js";
import {
    TOPLINE_NEED_MORE, TOPLINE_NON_EMPTY, TOPLINE_SPECIAL_PROMPT, WIN_STOP,
} from "../../src/wintty.h.js";
import { char, int, ord, schar, uchar } from "../../rt/ctypes.js";
import { global_scalar } from "../../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../../rt/heap.js";
import { EOF, fflush, stdout, strcat, strchr, strcpy } from "../../rt/libc.js";
import { stack_array, stack_var, static_var } from "../../rt/locals.js";
import { _ } from "../../rt/strings.js";
import { ptr_to } from "../../rt/struct.js";
import {
    extcmd_initiator, extcmd_via_menu, extcmds_getentry, extcmds_match, pgetchar,
} from "../../src/cmd.js";
import { gi, gt, iflags, program_state } from "../../src/decl.js";
import { eos, mungspaces, visctrl } from "../../src/hacklib.js";
import { custompline, pline } from "../../src/pline.js";
import { term_curs_set, tty_nhbell } from "./termcap.js";
import { addtopl, more, putsyms, tty_doprev_message } from "./topl.js";
import { tty_clear_nhwindow, tty_nhgetch, wins } from "./wintty.js";
