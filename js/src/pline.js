/* NetHack 5.0	pline.c	$NHDT-Date: 1719819280 2024/07/01 07:34:40 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.130 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

export const BIGBUFSZ = (5 * BUFSZ);

/* #ifdef DUMPLOG_CORE: not in this build */

/* keeps windowprocs usage out of pline() */
function putmesg(line) { /* void */
    let attr = ATR_NONE;

    if (iflags.debug_prevent_pline)
        return;

    if ((gp.pline_flags & URGENT_MESSAGE) != 0
        && (windowprocs.wincap2 & WC2_URGENT_MESG) != 0)
        attr |= ATR_URGENT;
    if ((gp.pline_flags & SUPPRESS_HISTORY) != 0
        && (windowprocs.wincap2 & WC2_SUPPRESS_HIST) != 0)
        attr |= ATR_NOHISTORY;
    putstr()(WIN_MESSAGE, attr, line);
    ;
}

/* set the direction where next message happens */
export function set_msg_dir(dir) { /* void */
    dirtocoord(a11y.msg_loc, dir);
    a11y.msg_loc.x += u.ux;
    a11y.msg_loc.y += u.uy;
}

/* set the coordinate where next message happens */
export function set_msg_xy(x, y) { /* void */
    a11y.msg_loc.x = x;
    a11y.msg_loc.y = y;
}

export function pline(line, ...args) { /* void */
    let the_args;

    the_args = va_start(args);
    vpline(line, the_args);
    va_end(the_args);
}

export function pline_dir(dir, line, ...args) { /* void */
    let the_args;

    set_msg_dir(dir);

    the_args = va_start(args);
    vpline(line, the_args);
    va_end(the_args);
}

export function pline_xy(x, y, line, ...args) { /* void */
    let the_args;

    set_msg_xy(x, y);

    the_args = va_start(args);
    vpline(line, the_args);
    va_end(the_args);
}

export function pline_mon(mtmp, line, ...args) { /* void */
    let the_args;

    if (mtmp == gy.youmonst)
        set_msg_xy(0, 0);
    else
        set_msg_xy(mtmp.mx, mtmp.my);

    the_args = va_start(args);
    vpline(line, the_args);
    va_end(the_args);
}

function vpline(line, the_args) { /* void */
    const $frame = stack_frame(); try {
    var in_pline = static_var("vpline.in_pline", int, 0);
    var pbuf = stack_array(char, BIGBUFSZ); /* will get chopped down to BUFSZ-1 if longer */
    var ln;
    var msgtyp;
    var no_repeat;
    var a11y_mesgxy = stack_struct(struct_nhcoord);

    struct_assign(a11y_mesgxy, a11y.msg_loc); /* save a11y.msg_loc before reseting it */
    /* always reset a11y.msg_loc whether we end up using it or not */
    a11y.msg_loc.x = a11y.msg_loc.y = 0;

    if (!line || !chars[line])
        return;

    if (program_state.done_hup)
        return;

    if (program_state.wizkit_wishing)
        return;

    /* when accessiblemsg is set and a11y.msg_loc is nonzero, use the latter
       to insert a location prefix in front of current message */
    if (a11y.accessiblemsg && isok(a11y_mesgxy.x, a11y_mesgxy.y)) {
        var tmp, dirstr, dirstrbuf = stack_array(char, QBUFSZ);

        dirstr = coord_desc(a11y_mesgxy.x, a11y_mesgxy.y, dirstrbuf,
                            ((iflags.getpos_coords == GPCOORDS_NONE)
                             ? GPCOORDS_COMFULL : iflags.getpos_coords));
        tmp = addr_of(alloc(unsigned(unsigned(strlen(line) + sizeof_string(": ")) + strlen(dirstr))));
        strcpy(tmp, dirstr);
        strcat(tmp, _(": "));
        strcat(tmp, line);
        vpline(tmp, the_args);
        free(tmp);
        return;
    }

    if (!strchr(line, ord('%'))) {
        /* format does not specify any substitutions; use it as-is */
        ln = int(strlen(line));
    } else if (chars[line + 0] == ord('%') && chars[line + 1] == ord('s') && !chars[line + 2]) {
        /* "%s" => single string; skip format and use its first argument;
           unlike with the format, it is irrelevant whether the argument
           contains any percent signs */
        line = va_arg(the_args); /*VA_NEXT(line,const char *);*/
        ln = int(strlen(line));
    } else {
        /* perform printf() formatting */
        ln = vsnprintf(pbuf, sizeof(array_of(char, BIGBUFSZ)), line, the_args);
        line = pbuf;
        /* note: 'ln' is number of characters attempted, not necessarily
           strlen(line); that matters for the overflow check; if we avoid
           the extremely-too-long panic then 'ln' will be actual length */
    }
    if (ln > sizeof(array_of(char, BIGBUFSZ)) - 1) /* extremely too long */
        panic(_("pline attempting to print %d characters!"), ln);

    if (ln > BUFSZ - 1) {
        /* too long but modestly so; allow but truncate, preserving final
           3 chars: "___ extremely long text" -> "___ extremely l...ext"
           (this may be suboptimal if overflow is less than 3) */
        if (line != pbuf) /* no '%' was present or format was just "%s" */
            strncpy(pbuf, line, BUFSZ - 1); /* caveat: unterminated */
        chars[pbuf + (BUFSZ - 1 - 6)] = chars[pbuf + (BUFSZ - 1 - 5)] = chars[pbuf + (BUFSZ - 1 - 4)] = ord('.');
        /* avoid strncpy; buffers could overlap if excess is small */
        chars[pbuf + (BUFSZ - 1 - 3)] = chars[line + (ln - 3)];
        chars[pbuf + (BUFSZ - 1 - 2)] = chars[line + (ln - 2)];
        chars[pbuf + (BUFSZ - 1 - 1)] = chars[line + (ln - 1)];
        chars[pbuf + (BUFSZ - 1)] = ord('\0');
        line = pbuf;
    }
    msgtyp = MSGTYP_NORMAL;

    /* use raw_print() if we're called too early (or perhaps too late
       during shutdown) or if we're being called recursively (probably
       via debugpline() in the interface code) */
    pline_done: { if (in_pline[0]++ || !iflags.window_inited) {
        /* [we should probably be using raw_printf("\n%s", line) here] */
        raw_print()(line);
        iflags.last_msg = PLNMSG_UNKNOWN;
        break pline_done;
    }

    no_repeat = (gp.pline_flags & PLINE_NOREPEAT) ? TRUE : FALSE;
    if ((gp.pline_flags & OVERRIDE_MSGTYPE) == 0) {
        msgtyp = msgtype_type(line, no_repeat);

        if ((gp.pline_flags & URGENT_MESSAGE) == 0
            && (msgtyp == MSGTYP_NOSHOW
                || (msgtyp == MSGTYP_NOREP && !strcmp(line, gp.prevmsg))))
            /* FIXME: we need a way to tell our caller that this message
             * was suppressed so that caller doesn't set iflags.last_msg
             * for something that hasn't been shown, otherwise a subsequent
             * message which uses alternate wording based on that would be
             * doing so out of context and probably end up seeming silly.
             * (Not an issue for no-repeat but matters for no-show.)
             */
            break pline_done;;
    }

    if (gv.vision_full_recalc) {
        var tmp_in_pline = in_pline[0];

        in_pline[0] = 0;
        vision_recalc(0);
        in_pline[0] = tmp_in_pline;
    }
    if (u.ux)
        flush_screen((gp.pline_flags & NO_CURS_ON_U) ? 0 : 1); /* %% */

    putmesg(line);

    execplinehandler(line);

    /* this gets cleared after every pline message */
    iflags.last_msg = PLNMSG_UNKNOWN;
    strncpy(gp.prevmsg, line, BUFSZ), chars[gp.prevmsg + (BUFSZ - 1)] = ord('\0');
    if (msgtyp == MSGTYP_STOP)
        display_nhwindow()(WIN_MESSAGE, TRUE); /* --more-- */
 }

    --in_pline[0];
    } finally { stack_pop($frame); }
}

/* pline() variant which can override MSGTYPE handling or suppress
   message history (tty interface uses pline() to issue prompts and
   they shouldn't be blockable via MSGTYPE=hide) */
export function custompline(pflags, line, ...args) { /* void */
    let the_args;

    the_args = va_start(args);
    gp.pline_flags = pflags;
    vpline(line, the_args);
    gp.pline_flags = 0;
    va_end(the_args);
}

/* if player has dismissed --More-- with ESC to suppress further messages
   until next input request, tell the interface that it should override that
   and re-enable them; equivalent to custompline(URGENT_MESSAGE, line, ...)
   but slightly simpler to use */
export function urgent_pline(line, ...args) { /* void */
    let the_args;

    the_args = va_start(args);
    gp.pline_flags = URGENT_MESSAGE;
    vpline(line, the_args);
    gp.pline_flags = 0;
    va_end(the_args);
}

export function Norep(line, ...args) { /* void */
    let the_args;

    the_args = va_start(args);
    gp.pline_flags = PLINE_NOREPEAT;
    vpline(line, the_args);
    gp.pline_flags = 0;
    va_end(the_args);
}

function You_buf(siz) { /* char * */
    if (siz > gy.you_buf_siz) {
        if (gy.you_buf)
            free(gy.you_buf);
        gy.you_buf_siz = siz + 10;
        gy.you_buf = addr_of(alloc(unsigned(gy.you_buf_siz)));
    }
    return gy.you_buf;
}

export function free_youbuf() { /* void */
    if (gy.you_buf)
        free(gy.you_buf), gy.you_buf = 0;
    gy.you_buf_siz = 0;
}

/* `prefix' must be a string literal, not a pointer */

export function You(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    vpline(strcat((strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You "))))))), _("You ")), tmp), line), the_args);
    va_end(the_args);
}

export function Your(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    vpline(strcat((strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("Your "))))))), _("Your ")), tmp), line), the_args);
    va_end(the_args);
}

export function You_feel(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    if (Unaware())
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You dream that you feel "))))))), _("You dream that you feel "));
    else
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You feel "))))))), _("You feel "));
    vpline(strcat(tmp, line), the_args);
    va_end(the_args);
}

export function You_cant(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    vpline(strcat((strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You can't "))))))), _("You can't ")), tmp), line), the_args);
    va_end(the_args);
}

export function pline_The(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    vpline(strcat((strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("The "))))))), _("The ")), tmp), line), the_args);
    va_end(the_args);
}

export function There(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    vpline(strcat((strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("There "))))))), _("There ")), tmp), line), the_args);
    va_end(the_args);
}

export function You_hear(line, ...args) { /* void */
    let the_args;
    let tmp;

    if ((Deaf() && !Unaware()) || !flags.acoustics)
        return;
    the_args = va_start(args);
    if (Underwater())
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You barely hear "))))))), _("You barely hear "));
    else if (Unaware())
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You dream that you hear "))))))), _("You dream that you hear "));
    else
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You hear "))))))), _("You hear "));  /* Deaf-aware */
    vpline(strcat(tmp, line), the_args);
    va_end(the_args);
}

export function You_see(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    if (Unaware())
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You dream that you see "))))))), _("You dream that you see "));
    else if (Blind()) /* caller should have caught this... */
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You sense "))))))), _("You sense "));
    else
        strcpy((tmp = You_buf(int((unsigned((strlen(line) + sizeof_string("You see "))))))), _("You see "));
    vpline(strcat(tmp, line), the_args);
    va_end(the_args);
}

/* Print a message inside double-quotes.
 * The caller is responsible for checking deafness.
 * Gods can speak directly to you in spite of deafness.
 */
export function verbalize(line, ...args) { /* void */
    let the_args;
    let tmp;

    the_args = va_start(args);
    gp.pline_flags |= PLINE_VERBALIZE;
    tmp = You_buf(int(unsigned(unsigned(int(strlen(line))) + sizeof_string("\"\""))));
    strcpy(tmp, _("\""));
    strcat(tmp, line);
    strcat(tmp, _("\""));
    vpline(tmp, the_args);
    gp.pline_flags &= unsigned(~PLINE_VERBALIZE);
    va_end(the_args);
}

export function gamelog_add(glflags, gltime, str) { /* void */
    let tmp;
    let lst = gg.gamelog;

    tmp = view_of(struct_gamelog_line, addr_of(alloc(sizeof(struct_gamelog_line))));
    tmp.turn = gltime;
    tmp.flags = glflags;
    tmp.text = dupstr(str);
    tmp.next = null;
    while (lst && lst.next)
        lst = lst.next;
    if (!lst)
        gg.gamelog = tmp;
    else
        lst.next = tmp;
}

export function livelog_printf(ll_type, line, ...args) { /* void */
    const $frame = stack_frame(); try {
    let gamelogbuf = stack_array(char, BUFSZ * 2);
    let the_args;

    the_args = va_start(args);
    vsnprintf(gamelogbuf, sizeof(array_of(char, BUFSZ * 2)), line, the_args);
    va_end(the_args);

    gamelog_add(ll_type, svm.moves, gamelogbuf);
    strNsubst(gamelogbuf, _("\t"), _("_"), 0);
    livelog_add(ll_type, gamelogbuf);
    } finally { stack_pop($frame); }
}

/* #else (#ifdef CHRONICLE): not in this build */

export function raw_printf(line, ...args) { /* void */
    let the_args;

    the_args = va_start(args);
    vraw_printf(line, the_args);
    va_end(the_args);
    if (!program_state.beyond_savefile_load)
        ge.early_raw_messages++;
}

function vraw_printf(line, the_args) { /* void */
    const $frame = stack_frame(); try {
    let pbuf = stack_array(char, BIGBUFSZ); /* will be chopped down to BUFSZ-1 if longer */

    if (strchr(line, ord('%'))) {
        vsnprintf(pbuf, sizeof(array_of(char, BIGBUFSZ)), line, the_args);
        line = pbuf;
    }
    if (int(strlen(line)) > BUFSZ - 1) {
        if (line != pbuf)
            line = strncpy(pbuf, line, BUFSZ - 1);
        /* unlike pline, we don't futz around to keep last few chars */
        chars[pbuf + (BUFSZ - 1)] = ord('\0'); /* terminate strncpy or truncate vsprintf */
    }
    raw_print()(line);
    execplinehandler(line);
    if (!program_state.beyond_savefile_load)
        ge.early_raw_messages++;
    } finally { stack_pop($frame); }
}

export function impossible(s, ...args) { /* void */
    const $frame = stack_frame(); try {
    let the_args;
    let pbuf = stack_array(char, BIGBUFSZ); /* will be chopped down to BUFSZ-1 if longer */
    let pbuf2 = stack_array(char, BUFSZ);

    the_args = va_start(args);
    if (program_state.in_impossible)
        panic(_("impossible called impossible"));

    program_state.in_impossible = 1;
    vsnprintf(pbuf, sizeof(array_of(char, BIGBUFSZ)), s, the_args);
    va_end(the_args);
    chars[pbuf + (BUFSZ - 1)] = ord('\0'); /* sanity */
    paniclog(_("impossible"), pbuf);
    if (iflags.debug_fuzzer == fuzzer_impossible_panic)
        panic(_("%s"), pbuf);

    gp.pline_flags = URGENT_MESSAGE;
    pline(_("%s"), pbuf);
    gp.pline_flags = 0;

    if (program_state.in_sanity_check) {
        /* skip rest of multi-line feedback */
        program_state.in_impossible = 0;
        return;
    }

    strcpy(pbuf2, _("Program in disorder!"));
    if (program_state.something_worth_saving)
        strcat(pbuf2, _("  (Saving and reloading may fix this problem.)"));
    pline(_("%s"), pbuf2);
    pline(_("Please report these messages to %s."), _(DEVTEAM_EMAIL));
    if (sysopt.support) {
        pline(_("Alternatively, contact local support: %s"), sysopt.support);
    }

    /* #ifdef CRASHREPORT: not in this build */

    program_state.in_impossible = 0;
    } finally { stack_pop($frame); }
}

const use_pline_handler = static_var("use_pline_handler", schar, TRUE);

function execplinehandler(line) { /* void */
    const $frame = stack_frame(); try {
    let f;

    let args = stack_array(ptr_to(char), 3);

    if (!use_pline_handler[0] || !sysopt.msghandler)
        return;

    f = fork();
    if (f == 0) { /* child */
        args[0] = sysopt.msghandler;
        args[1] = line;
        args[2] = 0;
        setgid(getgid());
        setuid(getuid());
        execv(args[0], args);
        perror(0);
        fprintf(stderr, _("Exec to message handler %s failed.\n"), sysopt.msghandler);
        nh_terminate(EXIT_FAILURE);
    } else if (f > 0) {
        let status = stack_var(int);

        waitpid(f, status, 0);
    } else if (f == -1) {
        perror(0);
        use_pline_handler[0] = FALSE;
        pline(_("%s"), _("Fork to message handler failed."));
    }
    /* #elif defined(WIN32) (#if defined(UNIX) && (defined(POSIX_TYPES) || defined(__GNUC__))): not in this build */
    } finally { stack_pop($frame); }
}

/* nhassert_failed is called when an nhassert's condition is false */
export function nhassert_failed(expression, filepath, line) { /* void */
    let filename, p;

    /* Attempt to get filename from path.
       TODO: we really need a port provided function to return a filename
       from a path. */
    filename = filepath;
    if ((p = strrchr(filename, ord('/'))) != 0)
        filename = p + 1;
    if ((p = strrchr(filename, ord('\\'))) != 0)
        filename = p + 1;
    /* #ifdef VMS: not in this build */

    impossible(_("nhassert(%s) failed in file '%s' at line %d"),
               expression, filename, line);
}

/*pline.c*/

import { struct_nhcoord } from "./coord.h.js";
import {
    GPCOORDS_COMFULL, GPCOORDS_NONE, PLNMSG_UNKNOWN, fuzzer_impossible_panic,
} from "./flag.h.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE } from "./global.h.js";
import {
    DEVTEAM_EMAIL, MSGTYP_NOREP, MSGTYP_NORMAL, MSGTYP_NOSHOW, MSGTYP_STOP, NO_CURS_ON_U,
    OVERRIDE_MSGTYPE, PLINE_NOREPEAT, PLINE_VERBALIZE, SUPPRESS_HISTORY, URGENT_MESSAGE,
    struct_gamelog_line,
} from "./hack.h.js";
import { WC2_SUPPRESS_HIST, WC2_URGENT_MESG } from "./winprocs.h.js";
import { display_nhwindow, putstr, raw_print } from "./winprocs.h.macros.js";
import { ATR_NOHISTORY, ATR_NONE, ATR_URGENT } from "./wintype.h.js";
import { Blind, Deaf, Unaware, Underwater } from "./youprop.h.macros.js";
import { char, int, ord, schar, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    EXIT_FAILURE, execv, fork, fprintf, free, getgid, getuid, perror, setgid, setuid, stderr,
    strcat, strchr, strcmp, strcpy, strlen, strncpy, strrchr, vsnprintf, waitpid,
} from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, struct_assign, view_of } from "../rt/struct.js";
import { va_arg, va_end, va_start } from "../rt/varargs.js";
import { alloc, dupstr } from "./alloc.js";
import { dirtocoord, isok } from "./cmd.js";
import { a11y, flags, ge, gg, gp, gv, gy, iflags, program_state, svm, u } from "./decl.js";
import { flush_screen } from "./display.js";
import { nh_terminate, panic } from "./end.js";
import { livelog_add, paniclog } from "./files.js";
import { coord_desc } from "./getpos.js";
import { strNsubst } from "./hacklib.js";
import { msgtype_type } from "./options.js";
import { sysopt } from "./sys.js";
import { vision_recalc } from "./vision.js";
import { windowprocs } from "./windows.js";
